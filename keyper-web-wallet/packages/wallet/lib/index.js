"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// Import Type Declarations
var container_1 = require("@keyper/container");
require("@keyper/specs");
// Require modules
// To do: Import these with types
var Secp256k1LockScript = require("@keyper/container/lib/locks/secp256k1").Secp256k1LockScript;
var AnyPayLockScript = require("@keyper/container/lib/locks/anyone-can-pay").AnyPayLockScript;
var keystore = require("@keyper/specs/lib/keystore");
var scrypt = require("scrypt.js");
var EC = require("elliptic").ec;
var SignatureAlgorithm = require("@keyper/specs/lib").SignatureAlgorithm;
var scriptToAddress = require("@keyper/specs/lib/address").scriptToAddress;
var Reader = require("ckb-js-toolkit").Reader;
//const { Container } = require("@keyper/container/lib");
// to do: add typescript methods in here rather than require from utils
var hexToBytes = function (hex) {
    return new Reader(hex).toArrayBuffer();
};
var DEV_MODE = true;
var WebWallet = /** @class */ (function () {
    function WebWallet(store, apiProvider, endpoints) {
        this.storage = store;
        this.apiProvider = apiProvider;
        this.endpoints = endpoints;
        if (!endpoints.hasOwnProperty("send") || !endpoints.hasOwnProperty("deps")) {
            throw Error("endpoints must at least specify 'send' and 'deps'");
        }
        var self = this;
        // Todo: Rewrite this using Container type
        this.container = new container_1.Container([{
                algorithm: SignatureAlgorithm.secp256k1,
                provider: {
                    sign: function (context, message) {
                        return __awaiter(this, void 0, void 0, function () {
                            var padToEven, key, privateKey, ec, keypair, msg, _a, r, s, recoveryParam, fmtR, fmtS, signature;
                            return __generator(this, function (_b) {
                                padToEven = function (value) {
                                    var a = value;
                                    if (typeof a !== 'string') {
                                        throw new Error("value must be string, is currently " + typeof a + ", while padToEven.");
                                    }
                                    if (a.length % 2) {
                                        a = "0" + a;
                                    }
                                    return a;
                                };
                                key = self.keys[context.publicKey];
                                if (!key) {
                                    throw new Error("no key for address: " + context.address);
                                }
                                privateKey = keystore.decrypt(key, context.password);
                                ec = new EC('secp256k1');
                                keypair = ec.keyFromPrivate(privateKey);
                                msg = typeof message === 'string' ? new Uint8Array(hexToBytes(message)) : message;
                                _a = keypair.sign(msg, {
                                    canonical: true,
                                }), r = _a.r, s = _a.s, recoveryParam = _a.recoveryParam;
                                if (recoveryParam === null) {
                                    throw new Error('Fail to sign the message');
                                }
                                fmtR = r.toString(16).padStart(64, '0');
                                fmtS = s.toString(16).padStart(64, '0');
                                signature = "0x" + fmtR + fmtS + padToEven(recoveryParam.toString(16));
                                return [2 /*return*/, signature];
                            });
                        });
                    }
                }
            }]);
        console.log("CONSTRUCTING");
    }
    // Todo: rewrite this w/ async/await
    WebWallet.prototype.addLockScripts = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, secpDep;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!DEV_MODE) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.apiProvider.get('/deps')];
                    case 1:
                        response = _a.sent();
                        secpDep = response.data;
                        this.container.addLockScript(new Secp256k1LockScript("0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8", "type", [{
                                outPoint: {
                                    txHash: secpDep.outPoint.txHash,
                                    index: "0x0"
                                },
                                depType: "depGroup",
                            }]));
                        return [3 /*break*/, 3];
                    case 2:
                        this.container.addLockScript(new Secp256k1LockScript("0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8", "type", [{
                                outPoint: {
                                    txHash: "0x6495cede8d500e4309218ae50bbcadb8f722f24cc7572dd2274f5876cb603e4e",
                                    index: "0x0"
                                },
                                depType: "depGroup",
                            }]));
                        this.container.addLockScript(new AnyPayLockScript("0x6a3982f9d018be7e7228f9e0b765f28ceff6d36e634490856d2b186acf78e79b", "type", [{
                                outPoint: {
                                    txHash: "0x9af66408df4703763acb10871365e4a21f2c3d3bdc06b0ae634a3ad9f18a6525",
                                    index: "0x0"
                                },
                                depType: "depGroup",
                            }]));
                        _a.label = 3;
                    case 3:
                        this.keys = {};
                        return [4 /*yield*/, this.reloadKeys()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebWallet.prototype.sendTx = function (signedTx, queryParams) {
        return __awaiter(this, void 0, void 0, function () {
            var target, result, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        target = this.endpoints["send"].url;
                        if (queryParams) {
                            target = target + queryParams;
                        }
                        return [4 /*yield*/, this.apiProvider.post(target, { signedTx: signedTx })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 2:
                        e_1 = _a.sent();
                        throw e_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WebWallet.prototype.signTx = function (lockHash, password, rawTx, config) {
        return __awaiter(this, void 0, void 0, function () {
            var tx, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.container.sign({
                                lockHash: lockHash,
                                password: password,
                            }, rawTx, config)];
                    case 1:
                        tx = _a.sent();
                        return [2 /*return*/, tx];
                    case 2:
                        e_2 = _a.sent();
                        throw e_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WebWallet.prototype.getAllLockHashesAndMeta = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.container.getAllLockHashesAndMeta()];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res];
                }
            });
        });
    };
    WebWallet.prototype.accounts = function () {
        return __awaiter(this, void 0, void 0, function () {
            var scripts, result, i, script;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAllLockHashesAndMeta()];
                    case 1:
                        scripts = _a.sent();
                        result = [];
                        for (i = 0; i < scripts.length; i++) {
                            script = scripts[i];
                            result.push({
                                address: scriptToAddress(script.meta.script, { networkPrefix: "ckt", short: true }),
                                type: script.meta.name,
                                lock: script.hash,
                                amount: 0,
                            });
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    WebWallet.prototype.importKey = function (privateKey, password) {
        return __awaiter(this, void 0, void 0, function () {
            var ec, key, publicKey, ks, keys;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ec = new EC('secp256k1');
                        key = ec.keyFromPrivate(privateKey);
                        publicKey = Buffer.from(key.getPublic().encodeCompressed()).toString("hex");
                        ks = keystore.encrypt(Buffer.from(privateKey, "hex"), password);
                        ks.publicKey = publicKey;
                        return [4 /*yield*/, this.storage.get("keys")];
                    case 1:
                        if (!!(_a.sent())) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.storage.set("keys", [ks])];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 3: return [4 /*yield*/, this.storage.get("keys")];
                    case 4:
                        keys = _a.sent();
                        keys.push(ks);
                        return [4 /*yield*/, this.storage.set("keys", keys)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        this.container.addPublicKey({
                            payload: "0x" + publicKey,
                            algorithm: SignatureAlgorithm.secp256k1,
                        });
                        this.keys["0x" + publicKey] = key;
                        return [2 /*return*/, publicKey];
                }
            });
        });
    };
    WebWallet.prototype.generateKey = function (password) {
        return __awaiter(this, void 0, void 0, function () {
            var ec, key, publicKey, privateKey, ks, keys;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ec = new EC('secp256k1');
                        key = ec.genKeyPair();
                        publicKey = Buffer.from(key.getPublic().encodeCompressed()).toString("hex");
                        privateKey = key.getPrivate();
                        ks = keystore.encrypt(privateKey.toArrayLike(Buffer), password);
                        ks.publicKey = publicKey;
                        return [4 /*yield*/, this.storage.get("keys")];
                    case 1:
                        if (!!(_a.sent())) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.storage.set("keys", [ks])];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 3: return [4 /*yield*/, this.storage.get("keys")];
                    case 4:
                        keys = _a.sent();
                        keys.push(ks);
                        return [4 /*yield*/, this.storage.set("keys", keys)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        this.container.addPublicKey({
                            payload: "0x" + publicKey,
                            algorithm: SignatureAlgorithm.secp256k1,
                        });
                        this.keys["0x" + publicKey] = key;
                        return [2 /*return*/, publicKey];
                }
            });
        });
    };
    WebWallet.prototype.unlock = function (password) {
        return __awaiter(this, void 0, void 0, function () {
            var hash, s;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.passwordToSeed(password)];
                    case 1:
                        hash = _a.sent();
                        hash = hash.toString("hex");
                        return [4 /*yield*/, this.storage.get("seed")];
                    case 2:
                        s = _a.sent();
                        console.log(this.seed, "<< THIS SEED IN UNLOCK");
                        if (s === hash) {
                            this.seed = hash;
                            return [2 /*return*/, true];
                        }
                        return [2 /*return*/, false];
                }
            });
        });
    };
    WebWallet.prototype.exists = function () {
        return __awaiter(this, void 0, void 0, function () {
            var s;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.storage.get("seed")];
                    case 1:
                        s = _a.sent();
                        return [2 /*return*/, s !== undefined && s !== null];
                }
            });
        });
    };
    WebWallet.prototype.createPassword = function (password) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, this.passwordToSeed(password)];
                    case 1:
                        _a.seed = _b.sent();
                        return [4 /*yield*/, this.storage.set("seed", this.seed.toString("hex"))];
                    case 2:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebWallet.prototype.reloadKeys = function () {
        return __awaiter(this, void 0, void 0, function () {
            var innerKeys;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.storage.get("keys")];
                    case 1:
                        if (!_a.sent()) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.storage.get("keys")];
                    case 2:
                        innerKeys = _a.sent();
                        console.log(innerKeys, "<< INNER KEYS");
                        innerKeys.forEach(function (key) {
                            _this.container.addPublicKey({
                                payload: "0x" + key.publicKey,
                                algorithm: SignatureAlgorithm.secp256k1,
                            });
                            _this.keys["0x" + key.publicKey] = key;
                        });
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WebWallet.prototype.hashPassword = function (password) {
        return __awaiter(this, void 0, void 0, function () {
            var salt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.storage.getSalt()];
                    case 1:
                        salt = _a.sent();
                        return [2 /*return*/, scrypt(password, salt, 16384, 8, 1, 16)];
                }
            });
        });
    };
    WebWallet.prototype.passwordToSeed = function (password) {
        return __awaiter(this, void 0, void 0, function () {
            var hash;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.hashPassword(password)];
                    case 1:
                        hash = _a.sent();
                        return [2 /*return*/, hash];
                }
            });
        });
    };
    return WebWallet;
}());
exports.WebWallet = WebWallet;
