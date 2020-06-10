import dotenv from "dotenv"
import secp256k1 from "secp256k1";
import { Reader, normalizers, validators } from "ckb-js-toolkit";
import blake2b from "blake2b";
import * as blockchain from "ckb-js-toolkit-contrib/src/blockchain";
import { Hasher } from "ckb-js-toolkit-contrib/src/hasher";
import * as nohm from "ckb-js-toolkit-contrib/src/cell_collectors/nohm";
const { Collector } = nohm;
import * as fs from "fs";
import deep_equal from "fast-deep-equal";

const resultEnv = dotenv.config()

export function ckbHash(buffer) {
  const h = new Hasher();
  h.update(buffer);
  return h.digest();
}

export function publicKeyHash(privateKey) {
  const publicKey = secp256k1.publicKeyCreate(
    new Uint8Array(new Reader(privateKey).toArrayBuffer())
  );
  const h = ckbHash(publicKey.buffer);
  return new Reader(h.toArrayBuffer().slice(0, 20)).serializeJson();
}

export function secpSign(privateKey, message) {
  const { signature, recid } = secp256k1.ecdsaSign(
    new Uint8Array(new Reader(message).toArrayBuffer()),
    new Uint8Array(new Reader(privateKey).toArrayBuffer())
  );
  const array = new Uint8Array(65);
  array.set(signature, 0);
  array.set([recid], 64);
  return new Reader(array.buffer);
}

export function validateLeaseCellInfo(leaseCellInfo) {
  ["holder_pubkey_hash", "builder_pubkey_hash"].forEach(key => {
    if (!leaseCellInfo[key]) {
      throw new Error(`${key} does not exist!`);
    }
    const reader = new Reader(leaseCellInfo[key]);
    if (reader.length() !== 20) {
      throw new Error(`Invalid length for ${key}`);
    }
  });
  if (!leaseCellInfo.coin_hash) {
    throw new Error("coin_hash does not exist!");
  }
  const reader = new Reader(leaseCellInfo.coin_hash);
  if (reader.length() !== 32) {
    throw new Error("Invalid length for coin_hash");
  }
  [
    "lease_period",
    "overdue_period",
    "last_payment_time",
    "amount_per_period"
  ].forEach(key => {
    if (!leaseCellInfo[key]) {
      throw Error(`${key} does not exist!`);
    }
    const i = leaseCellInfo[key];
    if (i === "0x0") {
      return;
    }
    if (!/^0x[1-9a-fA-F][0-9a-fA-F]*$/.test(i)) {
      throw new Error(`${key} must be a hex integer!`);
    }
  });
}

export function serializeLeaseCellInfo(leaseCellInfo) {
  validateLeaseCellInfo(leaseCellInfo);
  const array = new Uint8Array(104);
  array.set(
    new Uint8Array(
      new Reader(leaseCellInfo.holder_pubkey_hash).toArrayBuffer()
    ),
    0
  );
  array.set(
    new Uint8Array(
      new Reader(leaseCellInfo.builder_pubkey_hash).toArrayBuffer()
    ),
    20
  );
  array.set(
    new Uint8Array(new Reader(leaseCellInfo.coin_hash).toArrayBuffer()),
    40
  );
  const view = new DataView(array.buffer);
  view.setBigUint64(72, BigInt(leaseCellInfo.lease_period), true);
  view.setBigUint64(80, BigInt(leaseCellInfo.overdue_period), true);
  view.setBigUint64(88, BigInt(leaseCellInfo.last_payment_time), true);
  view.setBigUint64(96, BigInt(leaseCellInfo.amount_per_period), true);
  return new Reader(view.buffer);
}

export function deserializeLeaseCellInfo(buffer) {
  buffer = new Reader(buffer).toArrayBuffer();
  if (buffer.byteLength != 104) {
    throw new Error("Invalid array buffer length!");
  }
  const view = new DataView(buffer);
  return {
    holder_pubkey_hash: new Reader(buffer.slice(0, 20)).serializeJson(),
    builder_pubkey_hash: new Reader(buffer.slice(20, 40)).serializeJson(),
    coin_hash: new Reader(buffer.slice(40, 72)).serializeJson(),
    lease_period: "0x" + view.getBigUint64(72, true).toString(16),
    overdue_period: "0x" + view.getBigUint64(80, true).toString(16),
    last_payment_time: "0x" + view.getBigUint64(88, true).toString(16),
    amount_per_period: "0x" + view.getBigUint64(96, true).toString(16)
  };
}

export function intToLeBuffer(i) {
  i = BigInt(i);
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, i, true);
  return view.buffer;
}

export function assembleTransaction(txTemplate) {
  // Generate tx object and validate
  const tx = {
    version: "0x0",
    cell_deps:
      txTemplate.cellDeps,
    header_deps: txTemplate.headers || [],
    inputs: txTemplate.inputs.map(i => {
      return {
        previous_output: i.out_point,
        since: i.since || "0x0"
      };
    }),
    outputs: txTemplate.outputs.map(o => o.cell_output),
    outputs_data: txTemplate.outputs.map(o => o.data || "0x"),
    witnesses: txTemplate.inputs.map(i => i.witness || "0x")
  };
  validators.ValidateTransaction(tx);

  // Generate tx hash
  const txHash = ckbHash(
    new Reader(
      blockchain.SerializeRawTransaction(
        normalizers.NormalizeRawTransaction(tx)
      )
    )
  );


  const messagesToSign = [];
  const used = txTemplate.inputs.map(_i => false);
  for (let i = 0; i < txTemplate.inputs.length; i++) {
    if (used[i]) {
      continue;
    }
    used[i] = true;
    let firstWitness = tx.witnesses[i];
    if (firstWitness === "0x") {
      firstWitness = {};
    }
    const hasher = new Hasher();
    firstWitness.lock =
      "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const serializedWitness = new Reader(
      blockchain.SerializeWitnessArgs(
        normalizers.NormalizeWitnessArgs(firstWitness)
      )
    );
    tx.witnesses[i] = serializedWitness.serializeJson();
    hasher.update(txHash.toArrayBuffer());
    hasher.update(intToLeBuffer(serializedWitness.length()));
    hasher.update(serializedWitness.toArrayBuffer());
    for (let j = i + 1; j < txTemplate.inputs.length; j++) {
      if (
        deep_equal(
          txTemplate.inputs[i].cell_output.lock,
          txTemplate.inputs[j].cell_output.lock
        )
      ) {
        used[j] = true;
        const w = new Reader(tx.witnesses[j]);
        hasher.update(intToLeBuffer(w.length()));
        hasher.update(w.toArrayBuffer());
      }
    }
    const message = hasher.digest();
    messagesToSign.push({
      index: i,
      message: message.serializeJson(),
      lock: txTemplate.inputs[i].cell_output.lock
    });
  }
  return { tx, messagesToSign };
}

export function fillSignatures(tx, messagesToSign, signatures) {
  if (messagesToSign.length != signatures.length) {
    throw new Error("Invalid number of signatures!");
  }
  for (let i = 0; i < messagesToSign.length; i++) {
    const witnessArgs = new blockchain.WitnessArgs(
      new Reader(tx.witnesses[messagesToSign[i].index])
    );
    const newWitnessArgs = {
      lock: signatures[i]
    };
    const inputType = witnessArgs.getInputType();
    if (inputType.hasValue()) {
      newWitnessArgs.input_type = new Reader(
        inputType.value().raw()
      ).serializeJson();
    }
    const outputType = witnessArgs.getOutputType();
    if (outputType.hasValue()) {
      newWitnessArgs.output_type = new Reader(
        outputType.value().raw()
      ).serializeJson();
    }
    tx.witnesses[messagesToSign[i].index] = new Reader(
      blockchain.SerializeWitnessArgs(
        normalizers.NormalizeWitnessArgs(newWitnessArgs)
      )
    ).serializeJson();
  }
  return tx;
}

export function defaultLockScript(pubkeyHash) {
  const script = {
    code_hash:
      resultEnv.parsed.SECP_CODE_HASH,
    hash_type: "type",
    args: pubkeyHash
  };
  validators.ValidateScript(script);
  return script;
}

export function unpackUdtAmount(data) {
  const view = new DataView(new Reader(data).toArrayBuffer());
  const a = view.getBigUint64(0, true);
  const b = view.getBigUint64(8, true);
  return (b << 64n) | a;
}

export function packUdtAmount(amount) {
  const a = amount & BigInt("0xFFFFFFFFFFFFFFFF");
  const b = (amount >> 64n) & BigInt("0xFFFFFFFFFFFFFFFF");
  const view = new DataView(new ArrayBuffer(16));
  view.setBigUint64(0, a, true);
  view.setBigUint64(8, b, true);
  return new Reader(view.buffer);
}

export async function prepareUdtPayment(
  rpc,
  pubkeyHash,
  targetPubkeyHash,
  coinHash,
  amount
) {
  const script = defaultLockScript(pubkeyHash);
  const scriptHash = ckbHash(
    blockchain.SerializeScript(normalizers.NormalizeScript(script))
  );
  const collector = new Collector(
    rpc,
    {
      [nohm.KEY_LOCK_HASH]: scriptHash.serializeJson(),
      [nohm.KEY_TYPE_HASH]: new Reader(coinHash).serializeJson()
    },
    {
      skipCellWithContent: false,
      loadData: true
    }
  );
  let currentCapacity = BigInt(0);
  let currentAmount = BigInt(0);
  let currentCells = [];
  for await (const cell of collector.collect()) {
    currentCells.push(cell);
    currentCapacity += BigInt(cell.cell_output.capacity);
    currentAmount += unpackUdtAmount(cell.data);
  }
  if (currentCapacity < 100000000n + 14200000000n + 14200000000n) {
    throw new Error("Not enough capacity!");
  }
  if (currentAmount < amount) {
    throw new Error("Not enough UDTs!");
  }
  return {
    inputs: currentCells,
    outputs: [
      {
        cell_output: {
          capacity: "0x" + 14200000000n.toString(16),
          lock: defaultLockScript(targetPubkeyHash),
          type: currentCells[0].cell_output.type
        },
        data: packUdtAmount(amount).serializeJson()
      },
      {
        cell_output: {
          capacity:
            "0x" + (currentCapacity - 14200000000n - 100000000n).toString(16),
          lock: script,
          type: currentCells[0].cell_output.type
        },
        data: packUdtAmount(currentAmount - amount).serializeJson()
      }
    ]
  };
}

export async function collectCellForFees(rpc, pubkeyHash, fee = 100000000n) {
  const script = defaultLockScript(pubkeyHash);
  const scriptHash = ckbHash(
    blockchain.SerializeScript(normalizers.NormalizeScript(script))
  );
  const collector = new Collector(rpc, {
    [nohm.KEY_LOCK_HASH]: scriptHash.serializeJson()
  });
  let currentCapacity = BigInt(0);
  let currentCells = [];
  for await (const cell of collector.collect()) {
    currentCells.push(cell);
    currentCapacity += BigInt(cell.cell_output.capacity);

    if (currentCapacity >= fee + 6100000000n) {
      break;
    }
  }
  if (currentCapacity < fee + 6100000000n) {
    throw new Error("Not enough capacity!");
  }
  return {
    inputs: currentCells,
    outputs: [
      {
        cell_output: {
          capacity: "0x" + (currentCapacity - fee).toString(16),
          lock: script,
          type: null
        },
        data: null
      }
    ]
  };
}
