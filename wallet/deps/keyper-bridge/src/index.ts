import {EventEmitter} from "events"
const { v4 } = require("uuid");

type MessageType = string;
type MessageSource = string;
type Payload = {
  [key: string]: any
};


export interface WalletProviderMethodsMap {
  [methodName: string]: {
    returnMessage: string
    fields: string[]
  }
}
export interface Message {
  messageType: string
  messageSource: string
  payload: Payload
  messageId: string
}

export interface Serialization {
  serialize(message: Message): string
  deserialize(serializedMessage: string): Message
}

export interface MessageHandler {
  (message: Message): void
}

export interface SendChannel {
  send(message: Message): void
}



export interface HandlerReference {
  id: string
  type: MessageType
  bridge: KeyperBridge
  off(bridge: KeyperBridge, id: string, type: MessageType): boolean
}

export class ReceiveChannel {
  private channel: any;
  private addListenerMethod: string;
  private removeListenerMethod: string;
  private nativeEventType: string;
  private nativePayloadEventKey: string;
  private serialization: Serialization;

  constructor(channel: any, addListenerMethod: string, removeListenerMethod: string, nativeEventType: string, nativePayloadEventKey: string, serialization: Serialization) {
    this.channel = channel;
    this.addListenerMethod = addListenerMethod;
    this.nativeEventType = nativeEventType;
    this.nativePayloadEventKey = nativePayloadEventKey;
    this.serialization = serialization;
    this.removeListenerMethod = removeListenerMethod;
  }

  onOneMessage(messageId: string, handler: MessageHandler): void {
    let self = this
    let newHandler = (e?: any): null | void => {
      let messageData = "";
      if (e && e[self.nativePayloadEventKey]) {
        messageData = e[self.nativePayloadEventKey]
        let message: Message = self.serialization.deserialize(messageData)
        if (message.messageSource && message.messageSource === "keyper-bridge" && message.messageId === messageId) {
          handler(message)
        }
      } else {
        return null
      }
    }
    this.channel[this.addListenerMethod].call(this.channel, this.nativeEventType, newHandler)
  }

  onMessage(messageType: string, handler: MessageHandler) {
    let self = this
    let newHandler = (e?: any): null | void => {
      let messageData = "";
      if (e && e[self.nativePayloadEventKey]) {
        messageData = e[self.nativePayloadEventKey]
        let message: Message = self.serialization.deserialize(messageData)
        if (message.messageSource && message.messageSource === "keyper-bridge" && message.messageType === messageType) {
          handler(message)
        }
      } else {
        return null
      }
    }
    this.channel[this.addListenerMethod].call(this.channel, this.nativeEventType, newHandler)
  }

}

export class SendChannel implements SendChannel{
  private channel: any;
  private sendMethodName: string;
  private serialization: Serialization;
  private additionalSendArgs: string[];

  constructor(channel: any, sendMethodName: string, serialization: Serialization, additionalSendArgs: string[]){
    this.channel = channel
    this.sendMethodName = sendMethodName
    this.serialization = serialization
    this.additionalSendArgs = additionalSendArgs
  }

  send(message: Message) {
    let serializedMessage = this.serialization.serialize(message)
    this.channel[this.sendMethodName](serializedMessage, ...this.additionalSendArgs)
  }
}

export class KeyperBridge {
  [method: string]: any
  private wallet: any;
  private sendChannel: SendChannel;
  private receiveChannel: ReceiveChannel;
  private walletMethodsMap: WalletProviderMethodsMap;

  constructor(sendChannel: SendChannel, receiveChannel: ReceiveChannel, walletMethods: WalletProviderMethodsMap, wallet: any) {
    this.sendChannel = sendChannel
    this.receiveChannel = receiveChannel
    this.wallet = wallet
  //  this.handlers = []
    this.walletMethodsMap = walletMethods

    if (wallet === null) {
      this.addKeyperClientMiddleware()
    } else {
      this.addWalletMiddleWare()
    }
  }



  public onMessage(eventType: MessageType, cb: MessageHandler):void {
    this.receiveChannel.onMessage(eventType, cb)
  }

  public send(eventType: MessageType, payload: Payload, id: string | null):void {
    this.sendChannel.send({
      messageType: eventType,
      payload: payload,
      messageSource: "keyper-bridge",
      messageId: id || v4()
    })
  }


  public addWalletMethod(methodType: MessageType, cb: MessageHandler):boolean {
    let self = this
    if (this[methodType]) {
      return true;
    }
    this[methodType] = async (message: Message) => {
      let args = Object.keys(message.payload).map((key) => {
        return message.payload[key]
      })
      let result = await self.wallet[methodType](...args)
      self.sendChannel.send({
        messageId: message.messageId,
        messageType: "return_" + methodType,
        messageSource: "keyper-bridge",
        payload: result
      })
    }
    this.receiveChannel.onMessage(methodType, async (message) => {await self[methodType](message)})
    return true;
  }

  public addKeyperClientMethod(methodType: MessageType, expectedArgs: string[]):boolean {
    if (this[methodType]) {
      return true
    }
    this[methodType] = (args: {[key: string]: any}) => {

      let payload: Payload = {}
      expectedArgs.forEach((arg) => {
        if (!args.hasOwnProperty(arg)) {
          throw Error("Must include " + arg + " in args for method " + methodType)
        }
        payload[arg] = args[arg]
      })
      let message: Message = {
        messageType: methodType,
        messageSource: "keyper-bridge",
        payload: payload,
        messageId: v4()
      }
      this.sendChannel.send(message)
      return new Promise((resolve, reject) => {
        this.receiveChannel.onOneMessage(message.messageId, (message) => {
          resolve(message.payload)
        })
      })
    }
    return true
  }

  private addKeyperClientMiddleware():void {
    Object.keys(this.walletMethodsMap).forEach((method) => {
      this[method] = (args: {[key: string]: any}) => {
        let payload: Payload = {}
        this.walletMethodsMap[method].fields.forEach((field) => {
          if (!args.hasOwnProperty(field)) {
            throw Error("Must include " + field + " in args for method " + method )
          }
          payload[field] = args[field]
        })

        let message: Message = {
          messageType: method,
          messageSource: "keyper-bridge",
          payload: payload,
          messageId: v4()
        }
        this.sendChannel.send(message)
        return new Promise((resolve, reject) => {
          this.receiveChannel.onOneMessage(message.messageId, (message) => {
            resolve(message.payload)
          })
        })
      }
    })
  }

  private addWalletMiddleWare(): void {
    let self = this
    Object.keys(this.walletMethodsMap).forEach((method) => {

      this[method] = async (message: Message) => {

        let args = Object.keys(message.payload).map((key) => {
          return message.payload[key]
        })
        let result = await self.wallet[method](...args)
        self.sendChannel.send({
          messageId: message.messageId,
          messageType: self.walletMethodsMap[method].returnMessage,
          messageSource: "keyper-bridge",
          payload: result
        })
      }
      this.receiveChannel.onMessage(method, async (message) => {await self[method](message)})
    })

  }
}
