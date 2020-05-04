declare type MessageType = string;
declare type Payload = {
    [key: string]: any;
};
export interface WalletProviderMethodsMap {
    [methodName: string]: {
        returnMessage: string;
        fields: string[];
    };
}
export interface Message {
    messageType: string;
    messageSource: string;
    payload: Payload;
    messageId: string;
}
export interface Serialization {
    serialize(message: Message): string;
    deserialize(serializedMessage: string): Message;
}
export interface MessageHandler {
    (message: Message): void;
}
export interface SendChannel {
    send(message: Message): void;
}
export interface HandlerReference {
    id: string;
    type: MessageType;
    bridge: KeyperBridge;
    off(bridge: KeyperBridge, id: string, type: MessageType): boolean;
}
export declare class ReceiveChannel {
    private channel;
    private addListenerMethod;
    private removeListenerMethod;
    private nativeEventType;
    private nativePayloadEventKey;
    private serialization;
    constructor(channel: any, addListenerMethod: string, removeListenerMethod: string, nativeEventType: string, nativePayloadEventKey: string, serialization: Serialization);
    onOneMessage(messageId: string, handler: MessageHandler): void;
    onMessage(messageType: string, handler: MessageHandler): void;
}
export declare class SendChannel implements SendChannel {
    private channel;
    private sendMethodName;
    private serialization;
    private additionalSendArgs;
    constructor(channel: any, sendMethodName: string, serialization: Serialization, additionalSendArgs: string[]);
}
export declare class KeyperBridge {
    [method: string]: any;
    private wallet;
    private sendChannel;
    private receiveChannel;
    private walletMethodsMap;
    constructor(sendChannel: SendChannel, receiveChannel: ReceiveChannel, walletMethods: WalletProviderMethodsMap, wallet: any);
    onMessage(eventType: MessageType, cb: MessageHandler): void;
    send(eventType: MessageType, payload: Payload, id: string | null): void;
    addWalletMethod(methodType: MessageType, cb: MessageHandler): boolean;
    addKeyperClientMethod(methodType: MessageType, expectedArgs: string[]): boolean;
    private addKeyperClientMiddleware;
    private addWalletMiddleWare;
}
export {};
