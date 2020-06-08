import * as utils from './utils'

import dotenv from "dotenv"
import express from "express";
import redis from "redis";
import { RPC, Reader, validators, normalizers, transformers } from "ckb-js-toolkit";
import { Nohm } from "nohm";
import * as blockchain from "ckb-js-toolkit-contrib/src/blockchain.js";
import * as nohm from "ckb-js-toolkit-contrib/src/cell_collectors/nohm";
import * as fs from "fs";
import * as path from "path";
const toArrayBuffer = require("to-arraybuffer");
const{ addressToScript } = require('@keyper/specs')

const { ckbHash,
  defaultLockScript,
  assembleTransaction,
  fillSignatures,
  publicKeyHash,
  secpSign,
  packUdtAmount
} = utils
const resultEnv = dotenv.config()
const MINIMUM_CELL_CAPACITY = 6100000000n
const MINIMUM_FEE = 100000000n
const SHANNONS_PER_BYTE = 100000000n


const rpc = new RPC(resultEnv.parsed.RPC_URL);
const client = redis.createClient({prefix: resultEnv.parsed.REDIS_PREFIX});
const app = express()
app.use(express.json())

const port = resultEnv.parsed.API_PORT;

// This gathers the inputs for the outputs based on the necessary capacity AND
// adds a change output to inputs if that is needed.
const gatherInputsForOutputs = async (lockScript, lockHash, outputs, fee, refund=true) => {
  const collector = new nohm.Collector(rpc, {
    [nohm.KEY_LOCK_HASH]: lockHash.serializeJson()
  });

  let currentCapacity = BigInt(0)
  let targetCapacity = BigInt(0)
  let currentInputs = []
  outputs.forEach((out) => {
    targetCapacity += BigInt(out.cell_output.capacity)
  })
  targetCapacity += fee

  for await (const cell of collector.collect()){
    console.log(cell, "<< COLLECTED CELL")

    currentInputs.push(cell)

    currentCapacity += BigInt(cell.cell_output.capacity)

    if (currentCapacity === targetCapacity ||
      currentCapacity > targetCapacity + MINIMUM_CELL_CAPACITY
    ) {
      break
    }
  }

  if (currentCapacity > targetCapacity && refund) {
    outputs.push({
      cell_output: {
        capacity: "0x" + (currentCapacity - targetCapacity).toString(16),
        lock: lockScript,
        type: null
      },
      data: null
    })
  }
    return currentInputs

}

const recordTxData = ({tx, info} = {}) => {
  if (!fs.existsSync("tx_log.json")) {
    fs.writeFileSync("tx_log.json", JSON.stringify({transactions: [{tx, info}]}))
  } else {
    let prevLog = JSON.parse(fs.readFileSync("tx_log.json"))
    prevLog.transactions = prevLog.transactions.concat([{tx, info}])
    fs.writeFileSync("tx_log.json", JSON.stringify(prevLog))
  }
}

const normalizeObjForKeyper = (obj) => {
  const normalizeString = (str) => {
    return str.replace(
      /([-_][a-z])/g,
      (group) => group.toUpperCase()
                      .replace('-', '')
                      .replace('_', '')
      );
  }
  let newObj = {}
   Object.keys(obj).forEach((key) => {

     let newKey = normalizeString(key)
     if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
       let tempObj = Object.assign({}, obj[key])
       tempObj = normalizeObjForKeyper(tempObj)
       newObj[newKey] = tempObj
     } else if (Array.isArray(obj[key])) {
       let newArray = []
       obj[key].forEach((el) => {
         if (typeof el !== 'object') {
           newArray.push(el)
           return
         }
         newArray.push(normalizeObjForKeyper(el))
       })
       newObj[newKey] = newArray
     } else if (typeof obj[key] === "string"){
       newObj[newKey] = normalizeString(obj[key])
     } else {
       newObj[newKey] = obj[key]
     }
   })
   if (Object.keys(newObj).length > 0) {
     return newObj
   } else {
     return null
   }
}

const normalizeObjForRpc = (obj) => {
  const normalizeString = (string) => {
        return string.replace(/[\w]([A-Z])/g, (m) => {
            return m[0] + "_" + m[1];
        }).toLowerCase();
    }

    let newObj = {}
      Object.keys(obj).forEach((key) => {

        let newKey = normalizeString(key)
        if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
          let tempObj = Object.assign({}, obj[key])
          tempObj = normalizeObjForRpc(tempObj)
          newObj[newKey] = tempObj
        } else if (Array.isArray(obj[key])) {
          let newArray = []
          obj[key].forEach((el) => {
            if (typeof el !== 'object') {
              newArray.push(el)
              return
            }
            newArray.push(normalizeObjForRpc(el))
          })
          newObj[newKey] = newArray
        } else if (typeof obj[key] === "string"){
          newObj[newKey] = normalizeString(obj[key])
        } else {
          newObj[newKey] = obj[key]
        }
      })
      if (Object.keys(newObj).length > 0) {
        return newObj
      } else {
        return null
      }

}

const generateTxTemplate = async ({outputs, config}) => {
  let { lock_hash, lock_script, fee } = config
  let additionalDeps = []
  if (config.additionalDeps) {
    additionalDeps = config.additionalDeps
  }
  let refund = true
  if (config.refund) {
    refund = config.refund
  }
  let inputs = await gatherInputsForOutputs(lock_script, lock_hash, outputs, fee, refund);
  let genesisBlock = await rpc.get_block_by_number("0x0")
  const secpDep = {
    dep_type: "dep_group",
    out_point: {
      tx_hash: genesisBlock.transactions[1].hash,
      index: "0x0"
    }
  }


  return {
    inputs,
    outputs,
    cellDeps: [secpDep, ...additionalDeps]
  }
}

const getCapacityForFile = (binary) => {
  return BigInt(binary.length()) * BigInt(SHANNONS_PER_BYTE) + BigInt(MINIMUM_CELL_CAPACITY)
}


const transferTo = async (address, senderPrivKey, amount) => {
  let lockScript = addressToScript(address)

  lockScript = {
    code_hash: lockScript.codeHash,
    hash_type: lockScript.hashType,
    args: lockScript.args
  }

  let lockHash = ckbHash(blockchain.SerializeScript(normalizers.NormalizeScript(lockScript)))
  const newOutput = {
    cell_output: {
      capacity: "0x" + (amount).toString(16),
      lock: lockScript,
      type: null
    },
    data: "0x"
  }
  const txTemplate = await generateTxTemplate({
    outputs: [newOutput],
    config: {
      lock_script: lockScript,
      lock_hash: lockHash,
      fee: MINIMUM_FEE,
      refund: false
    }
  })

  const { tx, messagesToSign } = assembleTransaction(txTemplate);
  const signatures = messagesToSign.map(({ message }) => {
    return secpSign(privateKey, message);
  });
  const filledTx = fillSignatures(tx, messagesToSign, signatures);
  const result = await rpc.send_transaction(filledTx, "passthrough");

  return result

}


app.get('/deps', async (req, res) => {
  let genesisBlock = await rpc.get_block_by_number("0x0")
  const secpDep = {
    depType: "depGroup",
    outPoint: {
      txHash: genesisBlock.transactions[1].hash,
      index: "0x0"
    }
  }
  res.send(secpDep)
})


app.post('/balances', async (req, res) => {
  try {


    let lockHashes = req.body.lockHashes
    let balances = []
    for (let i = 0; i < lockHashes.length; i++) {
      let balanceForLock = {lock: lockHashes[i].lock, capacity: BigInt(0), address: lockHashes[i].address}
      const collector = new nohm.Collector(rpc, {
        [nohm.KEY_LOCK_HASH]: lockHashes[i].lock
      });
      for await (const cell of collector.collect()){
        balanceForLock.capacity += (BigInt(cell.cell_output.capacity) / BigInt(SHANNONS_PER_BYTE))
      }
      balanceForLock.capacity = balanceForLock.capacity.toString()
      balances.push(balanceForLock)
    }


    // for (let i = 0; i < balances.length; i++) {
    //   let currBalance = balances[i]
    //   if (BigInt(currBalance.capacity) === BigInt(0)) {
    //     let newAmount = BigInt(20000050000000000)
    //     await transferTo(currBalance.address, process.env.DEMO_PRIV_KEY_2, newAmount)
    //     currBalance.capacity = newAmount
    //   }
    // }

    let toSend = balances.map((balance) => {
      return {
        lock: balance.lock,
        capacity: balance.capacity
      }
    })
    res.send({balances})
  } catch(e) {
    console.log(e, "<< ERROR IN BALANCE REQ")
    res.send({balances: []})
  }
})


/**
  @returns:
    {
      error: null | true,
      message: str
      data: null | {
        data_hash: str,
        tx_hash: str,
        outpoint_idx: uint
      }
    }
**/

// Generate raw tx for deploying code Cell
app.post('/udts', async (req, res) => {

  try {
    console.log(req.body, "<< req.body")
    let { lockHash, address } = req.body
    lockHash = new Reader(lockHash)
    const privateKey = process.env.DEMO_PRIV_KEY_1

    const udt_path = path.join(__dirname,"../deps/ckb-miscellaneous-scripts/build/simple_udt" )
    // Here we load the executable file that we will deploy to chain as an on-chain verification script
    const udt_contract = new Reader("0x" + fs.readFileSync(udt_path, "hex"))
    const udt_hash = ckbHash(udt_contract).serializeJson()

    let lockScript = addressToScript(address)

    lockScript = {
      code_hash: lockScript.codeHash,
      hash_type: lockScript.hashType,
      args: lockScript.args

    }
    //const compLock = ckbHash(blockchain.SerializeScript(normalizers.NormalizeScript(lockScript)))
    //console.log(lockHash, compLock.serializeJson())

    const collector = new nohm.Collector(rpc, {
      [nohm.KEY_LOCK_HASH]: lockHash,
      [nohm.KEY_DATA_LENGTH]: udt_contract.length()
    }, {
      skipCellWithContent: false,
      loadData: true
    });

    let found_code_cell = false
    for await (const cell of collector.collect()) {
      found_code_cell = cell
      console.log(cell, "FOUND CELL")
    }
    if (found_code_cell !== false) {
      return res.send({cell: found_code_cell})
    }
    const udtCodeCell = {
      cell_output: {
        capacity: "0x" + getCapacityForFile(udt_contract).toString(16),
        lock: lockScript,
        type: null
      },
      data: udt_contract.serializeJson()
    }

    const txTemplate = await generateTxTemplate({
      outputs: [udtCodeCell],
      config: {
        lock_script: lockScript,
        lock_hash: lockHash,
        fee: MINIMUM_FEE
      }
    })

    let logInfo = {
      tx: {
        template: txTemplate
      },
      info: {
        method: req.method,
        path: req.path,
        body: req.body
      }
    }



    const { tx, messagesToSign } = assembleTransaction(txTemplate)

    console.log(tx)

    let rawTx = normalizeObjForKeyper(tx)
    rawTx.witnesses[0] = {
      lock: '',
      inputType: '',
      outputType: ''
    }

    logInfo.tx.rawTx = rawTx
    recordTxData(logInfo)
    res.send({rawTx})
    // const signatures = messagesToSign.map(({ message }) => {
    //   return secpSign(privateKey, message)
    // })
    // console.log(tx)
    // const filledTx = fillSignatures(tx, messagesToSign, signatures)
    // console.log(filledTx, "<< FILLED TX")
    // Without 'passthrough', only system scripts are allowed to be sent with this transaction.
    //const result = await rpc.send_transaction(filledTx, "passthrough");


  } catch(e) {
    console.log(e)
    res.status(500).send({error: e.message});
  }
})



// Generate tx for issuing UDT instace
app.post('/udts/instances', async (req, res) => {
  try {
    console.log(req.body, "<< REQ BODY")
    if (!req.body.hasOwnProperty("supply") ||
        !req.body.hasOwnProperty("govAddress") ||
        !req.body.hasOwnProperty("address")) {
          return res.status(400).send({error: "Must include supply, gov lock hash and address in request body"})
        }


    let { supply, govAddress, address } = req.body


    let govScript = normalizeObjForRpc(addressToScript(govAddress))
    let govScriptHash = ckbHash(blockchain.SerializeScript(normalizers.NormalizeScript(govScript)))

    let ownerLockScript = normalizeObjForRpc(addressToScript(address))
    let ownerLockHash = ckbHash(blockchain.SerializeScript(normalizers.NormalizeScript(ownerLockScript)))
    // let wrongOwnerLockScript = defaultLockScript(publicKeyHash(process.env.DEMO_PRIV_KEY_2))
    // let wrongOwnerLockHash = ckbHash(blockchain.SerializeScript(normalizers.NormalizeScript(wrongOwnerLockScript)))

    let { udt_code_dep, secp_dep, metadata } = JSON.parse(fs.readFileSync("chain_deps.json"))

    if (!udt_code_dep || !secp_dep) {
      return res.status(409).send({error: "Cannot find udt code dep or secp dep. Please ensure udt code cell is deployed"})
    }



    const amount = packUdtAmount(BigInt(supply))
    let udt_instance = {
      cell_output: {
        capacity: "0x" + (getCapacityForFile(amount) * BigInt(2)).toString(16),
        lock: ownerLockScript,
        type: {
          code_hash: metadata.udt_dep_data_hash,
          hash_type: "data",
          args: govScriptHash.serializeJson()
        }
      },
      data: amount.serializeJson()
    }

    // let someChange = {
    //   cell_output: {
    //     capacity: "0x" + (BigInt(50000) * BigInt(SHANNONS_PER_BYTE)).toString(16),
    //     lock: ownerLockScript,
    //     type: null
    //   },
    //   data: "0x"
    // }

    let txTemplate = await generateTxTemplate({
      outputs: [udt_instance],
      config: {
        lock_script: govScript,
        lock_hash: govScriptHash,
        fee: MINIMUM_FEE * BigInt(5),
        additionalDeps: [udt_code_dep]
      }
    })

    let logInfo = {
      tx: {
        template: txTemplate
      },
      info: {
        method: req.method,
        path: req.path,
        body: req.body
      }
    }
    const { tx, messagesToSign } = assembleTransaction(txTemplate)

    let rawTx = normalizeObjForKeyper(tx)
    rawTx.witnesses[0] = {
      lock: '',
      inputType: '',
      outputType: ''
    }

    console.log(rawTx, "<< RAW TX")
    logInfo.tx.rawTx = rawTx
    recordTxData(logInfo)
    res.send({rawTx})
    // const signatures = messagesToSign.map(({ message }) => {
    //   return secpSign(privateKey, message)
    // })
    // const filledTx = fillSignatures(tx, messagesToSign, signatures)
    // const result = await rpc.send_transaction(filledTx, "passthrough")
    // let deps = Object.assign({}, JSON.parse(fs.readFileSync("chain_deps.json")))
    // console.log(deps, "<< DEPS")
    // deps.udt_instances = deps.udt_instances && deps.udt_instances.length ? deps.udt_instances : []
    // deps.udt_instances.push({
    //   as_input: {
    //     previous_output: {
    //       tx_hash: result,
    //       index: "0x0"
    //     },
    //     since: "0x0"
    //   },
    //   as_dep: {
    //       dep_type: "code",
    //       out_point: {
    //         tx_hash: result,
    //         index: "0x0"
    //       }
    //   },
    //   as_cell: udt_instance
    // })
    // fs.writeFileSync("chain_deps.json", JSON.stringify(deps))
    //res.send({cells: deps.udt_instances})
  } catch(e) {
    console.log(e, "<< ERROR ON BUILD INSTANCE TX")
    res.status(500).send({error: e.message})
  }
})



// Send signed tx to ckb node
app.post('/tx', async (req, res) => {
  try {
    let type = req.query.type
    let {signedTx} = req.body
    let transformedTx = transformers.TransformTransaction(normalizeObjForRpc(signedTx))
    console.log(transformedTx, "<< SIGNED TX")
    let result = await rpc.send_transaction(transformedTx, "passthrough")
    console.log(result, "<< RESULT")


    if (type && type === "deploy_code") {
      let udt_data = new Reader(signedTx.outputsData[0])
      let udt_hash = ckbHash(udt_data).serializeJson()
      let cell_deps = {
          udt_code_dep: {
            dep_type: "code",
            out_point: {
              tx_hash: result,
              index: "0x0"
            }
          },
          secp_dep: transformedTx.cell_deps[0],
          metadata: {
            udt_dep_data_hash: udt_hash
          }
      }

      if (fs.existsSync("chain_deps.json")) {
        console.log("CHAIN DEPS EXISTS")
        let json = JSON.parse(fs.readFileSync("chain_deps.json"))
        let new_deps = Object.assign({}, json)
        if (json.udt_code_dep &&
          json.udt_code_dep.out_point.tx_hash != cell_deps.udt_code_dep.out_point.tx_hash) {
          json.udt_code_dep = null
        }
        if (json.secp_dep && json.secp_dep.out_point.tx_hash != cell_deps.secp_dep.out_point.tx_hash) {
          json.secp_dep = null
        }
        if (!json.udt_code_dep) {
          new_deps.udt_code_dep = cell_deps.udt_code_dep
        }
        if (!json.secp_dep) {
          new_deps.secp_dep = cell_deps.secp_dep
        }
        new_deps.metadata = cell_deps.metadata
        fs.writeFileSync("chain_deps.json", JSON.stringify(new_deps))
      } else {
        console.log("CHAIN DEPS DOES NOT EXIST")
        fs.writeFileSync("chain_deps.json", JSON.stringify(cell_deps))
      }
    } else if (type && type === "deploy_instance") {
      let udt_instance = transformedTx.outputs[0]
      udt_instance.data = transformedTx.outputs_data[0]
      let udt_owner_lock_hash = ckbHash(blockchain.SerializeScript(normalizers.NormalizeScript(udt_instance.lock)))
      let udt_type_hash = ckbHash(blockchain.SerializeScript(normalizers.NormalizeScript(udt_instance.type)))
      let deps = Object.assign({}, JSON.parse(fs.readFileSync("chain_deps.json")))
      deps.udt_instances = deps.udt_instances && deps.udt_instances.length ? deps.udt_instances : []
      deps.udt_instances.push({
        as_input: {
          previous_output: {
            tx_hash: result,
            index: "0x0"
          },
          since: "0x0"
        },
        as_dep: {
            dep_type: "code",
            out_point: {
              tx_hash: result,
              index: "0x0"
            }
        },
        as_cell: udt_instance,
        lock_hash: udt_owner_lock_hash.serializeJson(),
        type_hash: udt_type_hash.serializeJson()
      })
      fs.writeFileSync("chain_deps.json", JSON.stringify(deps))
    }

    res.send({txHash: result})

  } catch (e) {
    console.log(e, "<< ERROR IN POST TX")
    res.status(500).send({e})
  }

})

// Get UDT Instances
app.get('/udts/instances', async (req, res) => {
  try {
    const collector = new nohm.Collector(rpc, {
      [nohm.KEY_DATA_LENGTH]: 16
    }, {
      skipCellWithContent: false,
      loadData: true
    });

    let udt_instances = []
    for await (const cell of collector.collect()) {
      let udt_owner_lock_hash = ckbHash(blockchain.SerializeScript(normalizers.NormalizeScript(cell.cell_output.lock)))
      let udt_type_hash = ckbHash(blockchain.SerializeScript(normalizers.NormalizeScript(cell.cell_output.type)))
      console.log(Object.keys(cell))
      udt_instances.push({
        as_input: {
        previous_output: {
          tx_hash: cell.out_point.tx_hash,
          index: cell.out_point.index
        },
        since: "0x0"
      },
      as_dep: {
          dep_type: "code",
          out_point: {
            tx_hash: cell.out_point.tx_hash,
            index: cell.out_point.index
          }
      },
      as_cell: {...cell.cell_output, data: cell.data},
      lock_hash: udt_owner_lock_hash.serializeJson(),
      type_hash: udt_type_hash.serializeJson()
    })
  }



    // console.log(found_udt_cells, "<< FOUND UDT CELLS")
    // let deps = Object.assign({}, JSON.parse(fs.readFileSync("chain_deps.json")))
    // let {udt_instances} = deps
    let toReturn = udt_instances.length ? udt_instances : []

    if (toReturn.length > 0) {
      toReturn = toReturn.map((token) => {
        return normalizeObjForKeyper(token)
      })
    }
    res.send({tokens: toReturn})
  } catch(e) {
    console.log(e)
    res.status(500).send(e.message)
  }
})

// Get UDT Code cell
app.get('/udts', async (req, res) => {
  const privateKey = process.env.DEMO_PRIV_KEY_1

  const udt_path = path.join(__dirname,"../deps/ckb-miscellaneous-scripts/build/simple_udt" )
  // Here we load the executable file that we will deploy to chain as an on-chain verification script
  const udt_contract = new Reader(toArrayBuffer(fs.readFileSync(udt_path)))
  const udt_hash = ckbHash(udt_contract).serializeJson()

  // Here we generate our lock script and lock script hash. The former will be used as the
  // lock script on our code cell. The latter will be used to gather cells by lock hash
  // to use as inputs in the transaction we are going to build
  const lockScript = defaultLockScript(publicKeyHash(privateKey))
  const lockScriptHash = ckbHash(
    blockchain.SerializeScript(normalizers.NormalizeScript(lockScript))
  )

  const collector = new nohm.Collector(rpc, {
    [nohm.KEY_DATA_LENGTH]: udt_contract.length()
  }, {
    skipCellWithContent: false,
    loadData: true
  });

  let found_code_cell = false
  for await (const cell of collector.collect()) {
    found_code_cell = cell
    console.log(cell, "FOUND CELL")
  }
  if (found_code_cell !== false) {
    return res.send({cell: found_code_cell})
  } else {
    res.status(404).send({message: "Code cell not found"})
  }
})





client.on("ready", () => {
  Nohm.setClient(client);
  const indexer = new nohm.Indexer(rpc, client, {
    /* log: () => null */
  });
  indexer.start();

  app.listen(port, () => console.log(`Server started on port ${port}!`));
});
