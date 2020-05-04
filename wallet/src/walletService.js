import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as utils from './utils.js'
const scrypt = require("scrypt.js");
const EC = require("elliptic").ec;
const { SignatureAlgorithm } = require("@keyper/specs/lib");
const { Container } = require("@keyper/container/lib");
const { Secp256k1LockScript } = require("@keyper/container/lib/locks/secp256k1");
const { AnyPayLockScript } = require("@keyper/container/lib/locks/anyone-can-pay");
const { scriptToAddress } = require("@keyper/specs/lib/address");
const keystore = require("@keyper/specs/lib/keystore");
const storage = require("./storage");
const {
  packUdtAmount,
  unpackUdtAmount,
  hexToBytes
} = utils
const DEV_MODE = true;


let seed, keys, container;

const init = async () => {
  container = new Container([{
    algorithm: SignatureAlgorithm.secp256k1,
    provider: {
      padToEven: function(value) {
        var a = value;
        if (typeof a !== 'string') {
          throw new Error(`value must be string, is currently ${typeof a}, while padToEven.`);
        }
        if (a.length % 2) {
          a = `0${a}`;
        }
        return a;
      },
      sign: async function(context, message) {
        const key = keys[context.publicKey];
        if (!key) {
          throw new Error(`no key for address: ${context.address}`);
        }
        const privateKey = keystore.decrypt(key, context.password);

        const ec = new EC('secp256k1');
        const keypair = ec.keyFromPrivate(privateKey);
        const msg = typeof message === 'string' ? new Uint8Array(hexToBytes(message)) : message;
        let { r, s, recoveryParam } = keypair.sign(msg, {
          canonical: true,
        });
        if (recoveryParam === null){
          throw new Error('Fail to sign the message');
        }
        const fmtR = r.toString(16).padStart(64, '0');
        const fmtS = s.toString(16).padStart(64, '0');
        const signature = `0x${fmtR}${fmtS}${this.padToEven(recoveryParam.toString(16))}`;
        return signature;
      }
    }
  }]);

  if (DEV_MODE) {
    axios.get('/deps')
    .then((response) => {
      let secpDep = response.data

      container.addLockScript(new Secp256k1LockScript(
      "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8", "type", [{
        outPoint: {
          txHash: secpDep.outPoint.txHash,
          index: "0x0"
        },
        depType: "depGroup",
      }]
    ));
    })
    .catch((e) => {
      throw e;
    })

  } else {
    container.addLockScript(new Secp256k1LockScript(
      "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8", "type", [{
        outPoint: {
          txHash: "0x6495cede8d500e4309218ae50bbcadb8f722f24cc7572dd2274f5876cb603e4e",
          index: "0x0"
        },
        depType: "depGroup",
      }]
    ));
    container.addLockScript(new AnyPayLockScript(
      "0x6a3982f9d018be7e7228f9e0b765f28ceff6d36e634490856d2b186acf78e79b", "type", [{
        outPoint: {
          txHash: "0x9af66408df4703763acb10871365e4a21f2c3d3bdc06b0ae634a3ad9f18a6525",
          index: "0x0"
        },
        depType: "depGroup",
      }]
    ));
  }

  keys = {};
  reloadKeys();
};

const reloadKeys = () => {
  if (storage.keyperStorage().get("keys")) {
    const innerKeys = storage.keyperStorage().get("keys");
    innerKeys.forEach(key => {
      container.addPublicKey({
        payload: `0x${key.publicKey}`,
        algorithm: SignatureAlgorithm.secp256k1,
      });
      keys[`0x${key.publicKey}`] = key;
    });
  }
};

const hasWallet = () => {
  return storage.keyperStorage().get("keys")
}
const hashPassword = (password) => {
  const salt = storage.getSalt();
  return scrypt(password, salt, 16384, 8, 1, 16);
};

const passwordToSeed = (password) => {
  const hash = hashPassword(password);
  return hash;
};

const createPassword = async (password) => {
  seed = await passwordToSeed(password);
  storage.keyperStorage().set("seed", seed.toString("hex"));
};

const getSeed = () => seed;

const exists = () => {
  const s = storage.keyperStorage().get("seed");
  return s !== undefined && s !== null;
};

const unlock = async (password) => {
  const hash = passwordToSeed(password).toString("hex");
  const s = storage.keyperStorage().get("seed");
  if (s === hash) {
    seed = hash;
    return true;
  }
  return false;
};

const generateKey = async (password) => {
  const ec = new EC('secp256k1');
  const key = ec.genKeyPair();
  const publicKey = Buffer.from(key.getPublic().encodeCompressed()).toString("hex");
  const privateKey = key.getPrivate();

  console.log(privateKey.toArrayLike(Buffer).toString("hex"))

  const ks = keystore.encrypt(privateKey.toArrayLike(Buffer), password);
  ks.publicKey = publicKey;

  if (!storage.keyperStorage().get("keys")) {
    storage.keyperStorage().set("keys", [ks]);
  } else {
    const keys = storage.keyperStorage().get("keys");
    keys.push(ks);
    storage.keyperStorage().set("keys", keys);
  }
  container.addPublicKey({
    payload: `0x${publicKey}`,
    algorithm: SignatureAlgorithm.secp256k1,
  });
  keys[`0x${publicKey}`] = key;

  return publicKey;
};

const importKey = async (privateKey, password) => {
  const ec = new EC('secp256k1');
  const key = ec.keyFromPrivate(privateKey);
  const publicKey = Buffer.from(key.getPublic().encodeCompressed()).toString("hex");
  const ks = keystore.encrypt(Buffer.from(privateKey, "hex"), password);
  ks.publicKey = publicKey;

  if (!storage.keyperStorage().get("keys")) {
    storage.keyperStorage().set("keys", [ks]);
  } else {
    const keys = storage.keyperStorage().get("keys");
    keys.push(ks);
    storage.keyperStorage().set("keys", keys);
  }
  return publicKey;
};

const accounts = async () => {
  const scripts = await container.getAllLockHashesAndMeta();
  const result = [];
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    result.push({
      address: scriptToAddress(script.meta.script, {networkPrefix: "ckt", short: true}),
      type: script.meta.name,
      lock: script.hash,
      amount: 0,
    });
  }
  return result;
}


const signTx = async (lockHash, password, rawTx, config) => {
  const tx = await container.sign({
    lockHash: lockHash,
    password,
  }, rawTx, config);
  console.log(JSON.stringify(rawTx));
  return tx;
}

const getAllLockHashesAndMeta = async () => {
  return container.getAllLockHashesAndMeta();
}
const sendTx = async (signedTx, queryParam) => {
  console.log(signedTx, "<< TX TO SEND")
  console.log(queryParam, "<< QUERY PARAM TO INCLUDE")
  try {
    let res = await axios.post(`/tx?${queryParam}`, {
      signedTx
    })
    return res
  } catch(e) {
    return e
  }
}
(async () => {
  await init()
})()
export default {
  sendTx,
  container,
  hasWallet,
  createPassword,
  getSeed,
  unlock,
  exists,
  generateKey,
  importKey,
  accounts,
  signTx,
  getAllLockHashesAndMeta,
};
