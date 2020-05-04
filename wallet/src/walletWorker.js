import axios from 'axios'
import * as utils from './utils.js'
import { expose } from "threads/worker"
import { openDB, deleteDB, wrap, unwrap } from 'idb';
const { WebWallet } = require("@keyper-web-wallet/wallet")
const { Container } = require("@keyper/container/lib");
const scrypt = require("scrypt.js");
const EC = require("elliptic").ec;
const { SignatureAlgorithm } = require("@keyper/specs/lib");
const { Secp256k1LockScript } = require("@keyper/container/lib/locks/secp256k1");
const { AnyPayLockScript } = require("@keyper/container/lib/locks/anyone-can-pay");
const { scriptToAddress } = require("@keyper/specs/lib/address");
const keystore = require("@keyper/specs/lib/keystore");

const {
  packUdtAmount,
  unpackUdtAmount,
  hexToBytes
} = utils

function Store() {
  let db;
  const init = async () => {
    db = await openDB("web-wallet", 1, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log("DB UPGRADE REQUIRED")
      if (!db.objectStoreNames.contains("keyperStorage")) {
        db.createObjectStore("keyperStorage")
      }
    }})
    //await db.clear('keyperStorage');
  }

  this.get = async (key) => {
    if (!db) {
      await init()
    }

    let res = await db.get('keyperStorage', key)
    console.log(key, res, " << GET")
    return res
  }

  this.set = async (key, val) => {
    if (!db) {
      await init()
    }

    let res = await db.put('keyperStorage', val, key)
    console.log(key, res, " << SET")
    return res
  }

  this.getSalt = async () => {
    if (!db) {
      await init()
    }

    let res = await this.get("salt")
    if (!res) {
      return "SALT_ME"
    }
  }

}

let apiPROVIDER = axios

const endpoints = {
  "send": {
    url: "/tx"
  },
  "deps": {
    url: "/deps"
  }
}

let webWallet = new WebWallet(new Store(), apiPROVIDER, endpoints)
//
// const listw = () => {
//   console.log(webWallet, "<< FULL WEB WALLET")
//   console.log("SHOWING WEB WALLET")
//   console.log(webWallet["sendTx"], "<< SHOW BE A METHOD")
//   console.log(Object.keys(webWallet.__proto__), "<< KEYS IN WALLET")
// }
// listw()


let proxyWallet = () => {
  let proxyObj = {}
  Object.keys(webWallet.__proto__).forEach((key) => {
    proxyObj[key] = async (...args) => {
      let res = await webWallet[key](...args)
      return res
    }
  })
  return proxyObj
}


expose(proxyWallet())

// console.log(typeof webWallet, "<< WEB WALLET TYPE")
// console.log(webWallet, "<<WALLET WORKER INITIALIZED")
// console.log(webWallet.sendTx, "<<WALLET WORKER EXISTS METHOD")
// console.log(webWallet.__proto__, "<<WALLET WORKER proto")
