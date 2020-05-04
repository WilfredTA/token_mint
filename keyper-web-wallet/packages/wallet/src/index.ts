
// Import Type Declarations
import { Container, LockHashWithMeta } from '@keyper/container'
import {
  RawTransaction,
  Config,
  Hash256
} from '@keyper/specs'

// Require modules
// To do: Import these with types
const { Secp256k1LockScript } = require("@keyper/container/lib/locks/secp256k1");
const { AnyPayLockScript } = require("@keyper/container/lib/locks/anyone-can-pay");
const keystore = require("@keyper/specs/lib/keystore");
const scrypt = require("scrypt.js");
const EC = require("elliptic").ec;
const { SignatureAlgorithm } = require("@keyper/specs/lib");
const { scriptToAddress } = require("@keyper/specs/lib/address");
const { Reader } = require("ckb-js-toolkit");
//const { Container } = require("@keyper/container/lib");

// to do: add typescript methods in here rather than require from utils
const hexToBytes = function (hex) {
  return new Reader(hex).toArrayBuffer()
}

const DEV_MODE = true;



type PublicKey = string;
type SignedTransaction = RawTransaction;

type TransactionHash = string;

interface Account {
  address: string
  type: string
  lock: Hash256
  amount: number | string
}


export interface StorageProvider {
  get(key: string): any
  set(key: string, val: any): void
  getSalt(): string
}


export interface HTTPAPIProvider {
  get(url: string): Promise<any>
  post(url: string, data: object): Promise<any>
}

interface HTTPEndpoints {
  [key: string]: {
    url:string
  }
}

export class WebWallet {
  private container: Container;
  private storage: StorageProvider;
  private endpoints: HTTPEndpoints
  private apiProvider: HTTPAPIProvider
  private keys: object
  private seed: any

  public constructor(store: StorageProvider, apiProvider: HTTPAPIProvider, endpoints: HTTPEndpoints) {
    this.storage = store;
    this.apiProvider = apiProvider
    this.endpoints = endpoints
    if (!endpoints.hasOwnProperty("send") || !endpoints.hasOwnProperty("deps")) {
      throw Error("endpoints must at least specify 'send' and 'deps'")
    }
    let self = this


    this.container = new Container([{
      algorithm: SignatureAlgorithm.secp256k1,
      provider: {
        sign: async function(context, message) {
          const padToEven = (value) => {
            var a = value;
            if (typeof a !== 'string') {
              throw new Error(`value must be string, is currently ${typeof a}, while padToEven.`);
            }
            if (a.length % 2) {
              a = `0${a}`;
            }
            return a;
          }
          const key = self.keys[context.publicKey];
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
          const signature = `0x${fmtR}${fmtS}${padToEven(recoveryParam.toString(16))}`;
          return signature;
        }
      }
    }]);

  }


  public async addLockScripts(): Promise<any> {
    if (DEV_MODE) {
      let response = await this.apiProvider.get('/deps')

      let secpDep = response.data

      this.container.addLockScript(new Secp256k1LockScript(
        "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8", "type", [{
          outPoint: {
            txHash: secpDep.outPoint.txHash,
            index: "0x0"
          },
          depType: "depGroup",
        }]
      ));


    } else {
      this.container.addLockScript(new Secp256k1LockScript(
        "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8", "type", [{
          outPoint: {
            txHash: "0x6495cede8d500e4309218ae50bbcadb8f722f24cc7572dd2274f5876cb603e4e",
            index: "0x0"
          },
          depType: "depGroup",
        }]
      ));
      this.container.addLockScript(new AnyPayLockScript(
        "0x6a3982f9d018be7e7228f9e0b765f28ceff6d36e634490856d2b186acf78e79b", "type", [{
          outPoint: {
            txHash: "0x9af66408df4703763acb10871365e4a21f2c3d3bdc06b0ae634a3ad9f18a6525",
            index: "0x0"
          },
          depType: "depGroup",
        }]
      ));
    }
    this.keys = {};
    await this.reloadKeys();
  }
  public async sendTx(signedTx: SignedTransaction, queryParams?: string): Promise<TransactionHash> {
    try {

      let target = this.endpoints["send"].url

      if (queryParams) {
        target = target + queryParams
      }
      let result = await this.apiProvider.post(target, { signedTx })
      return result
    } catch(e) {
      throw e
    }
  }

  public async signTx(lockHash: Hash256, password: string, rawTx: RawTransaction, config: Config): Promise<SignedTransaction> {
    try {
      const tx = await this.container.sign({
        lockHash: lockHash,
        password,
      }, rawTx, config);
      return tx
    } catch(e) {
      throw e
    }
  }

  public async getAllLockHashesAndMeta(): Promise<LockHashWithMeta[]> {

    let res =  await this.container.getAllLockHashesAndMeta()
    return res
  }

  public async accounts(): Promise<Account[]> {
    const scripts = await this.getAllLockHashesAndMeta();
    const result = [] as Account[] ;
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

  public async importKey(privateKey: string, password: string): Promise<PublicKey> {
    const ec = new EC('secp256k1');
    const key = ec.keyFromPrivate(privateKey);
    const publicKey = Buffer.from(key.getPublic().encodeCompressed()).toString("hex");
    const ks = keystore.encrypt(Buffer.from(privateKey, "hex"), password);
    ks.publicKey = publicKey;

    if (!await this.storage.get("keys")) {
      await this.storage.set("keys", [ks]);
    } else {
      const keys = await this.storage.get("keys");
      keys.push(ks);
      await this.storage.set("keys", keys);
    }
    this.container.addPublicKey({
      payload: `0x${publicKey}`,
      algorithm: SignatureAlgorithm.secp256k1,
    });
    this.keys[`0x${publicKey}`] = key;
    return publicKey;
  }

  public async generateKey(password: string): Promise<PublicKey> {
    const ec = new EC('secp256k1');
    const key = ec.genKeyPair();
    const publicKey = Buffer.from(key.getPublic().encodeCompressed()).toString("hex");
    const privateKey = key.getPrivate();

    const ks = keystore.encrypt(privateKey.toArrayLike(Buffer), password);
    ks.publicKey = publicKey;

    if (!await this.storage.get("keys")) {
      await this.storage.set("keys", [ks]);
    } else {
      const keys = await this.storage.get("keys");
      keys.push(ks);
      await this.storage.set("keys", keys);
    }
    this.container.addPublicKey({
      payload: `0x${publicKey}`,
      algorithm: SignatureAlgorithm.secp256k1,
    });
    this.keys[`0x${publicKey}`] = key;

    return publicKey;
  }

  public async unlock(password: string): Promise<boolean> {
    let hash = await this.passwordToSeed(password);
    hash = hash.toString("hex")
    const s = await this.storage.get("seed");
    if (s === hash) {
      this.seed = hash;
      return true;
    }
    return false;
  }

  public async exists(): Promise<boolean> {
    const s = await this.storage.get("seed");
    return s !== undefined && s !== null;
  }

  public async createPassword(password: string): Promise<any> {
    this.seed = await this.passwordToSeed(password);
    await this.storage.set("seed", this.seed.toString("hex"));
  }

  private async reloadKeys(): Promise<any> {
    if (await this.storage.get("keys")) {
      const innerKeys = await this.storage.get("keys");
      innerKeys.forEach(key => {
        this.container.addPublicKey({
          payload: `0x${key.publicKey}`,
          algorithm: SignatureAlgorithm.secp256k1,
        });
        this.keys[`0x${key.publicKey}`] = key;
      });
    }
  }
  private async hashPassword(password: string): Promise<any> {
    const salt = await this.storage.getSalt();
    return scrypt(password, salt, 16384, 8, 1, 16);
  }

  private async passwordToSeed(password: string): Promise<any> {
    const hash = await this.hashPassword(password);
    return hash;
  }


}
