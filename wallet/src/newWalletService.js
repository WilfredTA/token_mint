
import axios from 'axios'
import * as utils from './utils.js'
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
  this.get = (key) => {
    let val = localStorage.getItem(key)
    if (val) {
      return JSON.parse(localStorage.getItem(key))
    } else {
      return undefined
    }
  }

  this.set = (key, val) => {
    return localStorage.setItem(key, JSON.stringify(val))
  }
  this.getSalt = () => {
    return this.get("salt") || "SALT_ME"
  }

}

let apiProvider = axios

const endpoints = {
  "send": {
    url: "/tx"
  },
  "deps": {
    url: "/deps"
  }
}


let wallet = new WebWallet(new Store(), apiProvider, endpoints)

export default wallet


// let keys;
//
// const container = new Container([{
//   algorithm: SignatureAlgorithm.secp256k1,
//   provider: {
//     padToEven: function(value) {
//       var a = value;
//       if (typeof a !== 'string') {
//         throw new Error(`value must be string, is currently ${typeof a}, while padToEven.`);
//       }
//       if (a.length % 2) {
//         a = `0${a}`;
//       }
//       return a;
//     },
//     sign: async function(context, message) {
//       const key = keys[context.publicKey];
//       if (!key) {
//         throw new Error(`no key for address: ${context.address}`);
//       }
//       const privateKey = keystore.decrypt(key, context.password);
//
//       const ec = new EC('secp256k1');
//       const keypair = ec.keyFromPrivate(privateKey);
//       const msg = typeof message === 'string' ? new Uint8Array(hexToBytes(message)) : message;
//       let { r, s, recoveryParam } = keypair.sign(msg, {
//         canonical: true,
//       });
//       if (recoveryParam === null){
//         throw new Error('Fail to sign the message');
//       }
//       const fmtR = r.toString(16).padStart(64, '0');
//       const fmtS = s.toString(16).padStart(64, '0');
//       const signature = `0x${fmtR}${fmtS}${this.padToEven(recoveryParam.toString(16))}`;
//       return signature;
//     }
//   }
// }]);
//
// const reloadKeys = () => {
//   if (storage.get("keys")) {
//     const innerKeys = storage.get("keys");
//     innerKeys.forEach(key => {
//       container.addPublicKey({
//         payload: `0x${key.publicKey}`,
//         algorithm: SignatureAlgorithm.secp256k1,
//       });
//       keys[`0x${key.publicKey}`] = key;
//     });
//   }
// };
