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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("events");
var v4 = require("uuid").v4;
var ReceiveChannel = /** @class */ (function () {
    function ReceiveChannel(channel, addListenerMethod, removeListenerMethod, nativeEventType, nativePayloadEventKey, serialization) {
        this.channel = channel;
        this.addListenerMethod = addListenerMethod;
        this.nativeEventType = nativeEventType;
        this.nativePayloadEventKey = nativePayloadEventKey;
        this.serialization = serialization;
        this.removeListenerMethod = removeListenerMethod;
    }
    ReceiveChannel.prototype.onOneMessage = function (messageId, handler) {
        var self = this;
        var newHandler = function (e) {
            var messageData = "";
            if (e && e[self.nativePayloadEventKey]) {
                messageData = e[self.nativePayloadEventKey];
                var message = self.serialization.deserialize(messageData);
                if (message.messageSource && message.messageSource === "keyper-bridge" && message.messageId === messageId) {
                    handler(message);
                }
            }
            else {
                return null;
            }
        };
        this.channel[this.addListenerMethod].call(this.channel, this.nativeEventType, newHandler);
    };
    ReceiveChannel.prototype.onMessage = function (messageType, handler) {
        var self = this;
        var newHandler = function (e) {
            var messageData = "";
            if (e && e[self.nativePayloadEventKey]) {
                messageData = e[self.nativePayloadEventKey];
                var message = self.serialization.deserialize(messageData);
                if (message.messageSource && message.messageSource === "keyper-bridge" && message.messageType === messageType) {
                    handler(message);
                }
            }
            else {
                return null;
            }
        };
        this.channel[this.addListenerMethod].call(this.channel, this.nativeEventType, newHandler);
    };
    return ReceiveChannel;
}());
exports.ReceiveChannel = ReceiveChannel;
var SendChannel = /** @class */ (function () {
    function SendChannel(channel, sendMethodName, serialization, additionalSendArgs) {
        this.channel = channel;
        this.sendMethodName = sendMethodName;
        this.serialization = serialization;
        this.additionalSendArgs = additionalSendArgs;
    }
    SendChannel.prototype.send = function (message) {
        var _a;
        var serializedMessage = this.serialization.serialize(message);
        (_a = this.channel)[this.sendMethodName].apply(_a, __spreadArrays([serializedMessage], this.additionalSendArgs));
    };
    return SendChannel;
}());
exports.SendChannel = SendChannel;
var KeyperBridge = /** @class */ (function () {
    function KeyperBridge(sendChannel, receiveChannel, walletMethods, wallet) {
        this.sendChannel = sendChannel;
        this.receiveChannel = receiveChannel;
        this.wallet = wallet;
        //  this.handlers = []
        this.walletMethodsMap = walletMethods;
        if (wallet === null) {
            this.addKeyperClientMiddleware();
        }
        else {
            this.addWalletMiddleWare();
        }
    }
    KeyperBridge.prototype.onMessage = function (eventType, cb) {
        this.receiveChannel.onMessage(eventType, cb);
    };
    KeyperBridge.prototype.send = function (eventType, payload, id) {
        this.sendChannel.send({
            messageType: eventType,
            payload: payload,
            messageSource: "keyper-bridge",
            messageId: id || v4()
        });
    };
    KeyperBridge.prototype.addWalletMethod = function (methodType, cb) {
        var _this = this;
        var self = this;
        if (this[methodType]) {
            return true;
        }
        this[methodType] = function (message) { return __awaiter(_this, void 0, void 0, function () {
            var args, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        args = Object.keys(message.payload).map(function (key) {
                            return message.payload[key];
                        });
                        return [4 /*yield*/, (_a = self.wallet)[methodType].apply(_a, args)];
                    case 1:
                        result = _b.sent();
                        self.sendChannel.send({
                            messageId: message.messageId,
                            messageType: "return_" + methodType,
                            messageSource: "keyper-bridge",
                            payload: result
                        });
                        return [2 /*return*/];
                }
            });
        }); };
        this.receiveChannel.onMessage(methodType, function (message) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, self[methodType](message)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        }); }); });
        return true;
    };
    KeyperBridge.prototype.addKeyperClientMethod = function (methodType, expectedArgs) {
        var _this = this;
        if (this[methodType]) {
            return true;
        }
        this[methodType] = function (args) {
            var payload = {};
            expectedArgs.forEach(function (arg) {
                if (!args.hasOwnProperty(arg)) {
                    throw Error("Must include " + arg + " in args for method " + methodType);
                }
                payload[arg] = args[arg];
            });
            var message = {
                messageType: methodType,
                messageSource: "keyper-bridge",
                payload: payload,
                messageId: v4()
            };
            _this.sendChannel.send(message);
            return new Promise(function (resolve, reject) {
                _this.receiveChannel.onOneMessage(message.messageId, function (message) {
                    resolve(message.payload);
                });
            });
        };
        return true;
    };
    KeyperBridge.prototype.addKeyperClientMiddleware = function () {
        var _this = this;
        Object.keys(this.walletMethodsMap).forEach(function (method) {
            _this[method] = function (args) {
                var payload = {};
                _this.walletMethodsMap[method].fields.forEach(function (field) {
                    if (!args.hasOwnProperty(field)) {
                        throw Error("Must include " + field + " in args for method " + method);
                    }
                    payload[field] = args[field];
                });
                var message = {
                    messageType: method,
                    messageSource: "keyper-bridge",
                    payload: payload,
                    messageId: v4()
                };
                _this.sendChannel.send(message);
                return new Promise(function (resolve, reject) {
                    _this.receiveChannel.onOneMessage(message.messageId, function (message) {
                        resolve(message.payload);
                    });
                });
            };
        });
    };
    KeyperBridge.prototype.addWalletMiddleWare = function () {
        var _this = this;
        var self = this;
        Object.keys(this.walletMethodsMap).forEach(function (method) {
            _this[method] = function (message) { return __awaiter(_this, void 0, void 0, function () {
                var args, result;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            args = Object.keys(message.payload).map(function (key) {
                                return message.payload[key];
                            });
                            return [4 /*yield*/, (_a = self.wallet)[method].apply(_a, args)];
                        case 1:
                            result = _b.sent();
                            self.sendChannel.send({
                                messageId: message.messageId,
                                messageType: self.walletMethodsMap[method].returnMessage,
                                messageSource: "keyper-bridge",
                                payload: result
                            });
                            return [2 /*return*/];
                    }
                });
            }); };
            _this.receiveChannel.onMessage(method, function (message) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, self[method](message)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            }); }); });
        });
    };
    return KeyperBridge;
}());
exports.KeyperBridge = KeyperBridge;
