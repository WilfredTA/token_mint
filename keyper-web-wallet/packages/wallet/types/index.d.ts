import { LockHashWithMeta } from '@keyper/container';
import { RawTransaction, Config, Hash256 } from '@keyper/specs';
declare type PublicKey = string;
declare type SignedTransaction = RawTransaction;
declare type TransactionHash = string;
interface Account {
    address: string;
    type: string;
    lock: Hash256;
    amount: number | string;
}
export interface StorageProvider {
    get(key: string): any;
    set(key: string, val: any): void;
    getSalt(): string;
}
export interface HTTPAPIProvider {
    get(url: string): Promise<any>;
    post(url: string, data: object): Promise<any>;
}
interface HTTPEndpoints {
    [key: string]: {
        url: string;
    };
}
export declare class WebWallet {
    private container;
    private storage;
    private endpoints;
    private apiProvider;
    private keys;
    private seed;
    constructor(store: StorageProvider, apiProvider: HTTPAPIProvider, endpoints: HTTPEndpoints);
    addLockScripts(): Promise<any>;
    sendTx(signedTx: SignedTransaction, queryParams?: string): Promise<TransactionHash>;
    signTx(lockHash: Hash256, password: string, rawTx: RawTransaction, config: Config): Promise<SignedTransaction>;
    getAllLockHashesAndMeta(): Promise<LockHashWithMeta[]>;
    accounts(): Promise<Account[]>;
    importKey(privateKey: string, password: string): Promise<PublicKey>;
    generateKey(password: string): Promise<PublicKey>;
    unlock(password: string): Promise<boolean>;
    exists(): Promise<boolean>;
    createPassword(password: string): Promise<any>;
    private reloadKeys;
    private hashPassword;
    private passwordToSeed;
}
export {};
