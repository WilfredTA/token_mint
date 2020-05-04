import EventEmitter from 'events'
import { v4 as uuidv4 } from 'uuid'


class KeyperBridge extends EventEmitter {
  constructor({
    channel,
    sendChannel,
    receiveChannel,
    writeMethod = 'postMessage',
    receiveEventName = "message",
    additionalSendArgs = ["*"],
    wallet=null
    } = {}) {

    super()
    this.subscriptions = {}
    this.serialization = {
      serializeMethod: JSON.stringify,
      deserializeMethod: JSON.parse,
    }
    this.schema = {source: "source", type: "name", payload: "payload"}
    this.receiveEventName = receiveEventName
    this.writeMethod = writeMethod
    this.handlers = {}
    this.registry = {}
    this.selfHandlers = {}
    this.addChannelListenerMethod = "addEventListener"
    this.checkAdditionalFields = (e) => {return true}
    this.additionalSendArgs = additionalSendArgs
    this.keyper_messages = {
      'get_all_lock_hashes_and_meta': {
        method: 'getAllLockHashesAndMeta',
        return_message: 'return_all_lock_hashes_and_meta',
        args_rules: {fields: []}
      },
      'sign': {
        method: 'sign',
        return_message: 'return_signed_tx',
        args_rules: {
          required_length: 3,
          fields: [
            'lockHash',
            'rawTx',
            'config'
          ]

        }
      },
      'send_tx': {
        method: 'sendTx',
        return_message: 'return_send_tx_result',
        args_rules: { fields: [
          'signedTx',
          'queryParam'
        ]}
      },
      'accounts': {
        method: 'accounts',
        return_message: 'return_accounts',
        args_rules: {
          fields: []
        }
      }
    }
    if (!(channel || (sendChannel && receiveChannel))) {
      throw("Must include either bidirectional channel or a send and receive channel")
    }

    if (channel) {
      this.constructor.validateChannelType(channel)
      this.sendChannel = channel
      this.receiveChannel = channel
    } else {
      this.constructor.validateChannelType(receiveChannel)
      this.sendChannel = sendChannel
      this.receiveChannel = receiveChannel
    }

    if (wallet) {
      this.wallet = wallet
      this.addWalletMiddleWare()
    } else {
      this.addKeyperClientMiddleware()
    }



  }

  addWalletMiddleWare() {
    let { payload } = this.schema
    Object.keys(this.keyper_messages).forEach((message) => {

      let {method, return_message, args_rules} = this.keyper_messages[message]
      if (method === "sign") {
        return;
      }
      let handler = this.on(message, async (data, e) => {
        handler.unregister()
        let args = []
        let malformed = false
        try {
          args_rules.fields.forEach((field) => {
            let payloadData = data[payload]
            if (!payloadData[field]) {
              malformed = true
            }
            args.push(payloadData[field])
          })
          if (malformed) {
            this.send("error_" + message, "missing args", this.additionalSendArgs)
          } else {
            let result = await this.wallet[method](...args)
            this.send(return_message, result, this.additionalSendArgs)
          }
        } catch(e) {
          console.log(e, "<< E FROM responding to " + message)
        }

      })
    })
    console.log(this)
    // adds event handlers for messages that execute the appropriate wallet method and return result
  }

  addKeyperClientMiddleware() {
    Object.keys(this.keyper_messages).forEach((message) => {
      let {method, args_rules, return_message} = this.keyper_messages[message]

      this[method] = async (args, cb) => {
         args_rules.fields.forEach((arg) => {
          if (!args.hasOwnProperty(arg)) {
            console.log("Wrong args")
            throw("Must include these args: ", args_rules.fields)
          }
        })
        this.on(return_message, (payload) => {
          cb(payload)
        })
        this.send(message, args)
      }
    })
    // adds methods for auto sending wallet the right message, binds the event, and then unbinds after response
  }
  send(type, payload,  ...args) {
    if (type === "return_signed_tx") {
      console.log("Return sign tx is being sent")
    }
    let typeField = this.schema.type
    let payloadField = this.schema.payload
    let message = {}
    message[typeField] = type
    message[payloadField] = payload
    message.source = "keyper-bridge"

    message = this.serialization.serializeMethod(message)

    this.sendChannel[this.writeMethod](message, ...this.additionalSendArgs)
  }

  parsePayload(e, eventType) {

    let { data } = e
    const { deserializeMethod } = this.serialization
    const schema = this.schema
    let valid = true

    if (typeof data === 'string') {
      data = deserializeMethod(data)
    }

    let payload = {}
    Object.keys(schema).forEach((key) => {
      const field = schema[key]
      if (!data.hasOwnProperty(field)){
        valid = false
      } else {
        payload[field] = data[field]
      }
    })

    return {
      type: payload[schema.type] || "Unknown",
      valid,
      payload
    }
  }

  checkSource(e) {
    let { data } = e

    if (typeof data === 'string' ) {
      try {
        data = this.serialization.deserializeMethod(data)
      } catch(e) {
        console.log(e, "<< ERROR PARSING")
        return false
      }
    }


    return (
      data && data.source && data.source === "keyper-bridge" && this.checkAdditionalFields(e)
    )
  }



  onSelf(eventType, handler) {
    let self = this
    let id = uuidv4()
    this.selfHandlers[eventType] ? this.selfHandlers[eventType].push({id, handler}) :
      this.selfHandlers[eventType] = [{id, handler}]
    super.on(eventType, handler)
    return {
      id,
      handler,
      unregister: function() {
        self.offSelf(eventType, handler, id)
      }
    }
  }

  offSelf(eventType, handler, id) {
    let targetHandlers = this.selfHandlers[eventType]
    targetHandlers =  targetHandlers.filter((hand) => {
      return hand.id !== id
    })
    super.off(eventType, handler)
    this.selfHandlers[eventType] = targetHandlers

  }


  decoratedHandler(eventType, handler) {
    let self = this
    return (e) => {
      if (self.checkSource(e)) {
        let {type, valid, payload} = self.parsePayload(e, eventType)
        console.log(type, valid, payload)
        if (!valid) {
          self.emit('invalid', type, eventType, payload)
        } else if (type === eventType){
          let res = self.emit(eventType, payload, e)
        }
      }

    }
  }

  on(eventType, handler) {
    let name = this.receiveEventName
    let newHandler = this.decoratedHandler(eventType, handler)
    this.receiveChannel.addEventListener(name, newHandler)
    super.on(eventType, handler)
    let handlerId = uuidv4()
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = [{id: handlerId, handler: newHandler}]
    } else {
      this.handlers[eventType].push({id: handlerId, handler: newHandler})
    }
    this.registry[handlerId] = eventType


    let self = this
    return {
      handlerId,
      eventType,
      unregister: function() {
        self.off(eventType, handlerId, handler)
      }
    }
  }

  off(eventType, handlerId, handler) {
    let name = this.receiveEventName
    let registeredEventType = this.registry[handlerId]
    let handlers = this.handlers[registeredEventType]
    if (!eventType || !handlers || registeredEventType !== eventType) {
      console.log("Event not found")
      return false
    }

    let targetHandler = null
    handlers = handlers.filter((hand) => {
      console.log(hand, "<< HAND")
      console.log(handler, "<< handler")
      if (hand.id === handlerId) {
        targetHandler = hand
        return false
      }
    })

    delete this.registry[handlerId]
    this.receiveChannel.removeEventListener(name, targetHandler.handler)
    this.handlers[eventType] = handlers
    super.off(eventType, handler)
  }

  static validateChannelType(channelType) {
    if (
      !(channelType &&
      typeof channelType === "object" &&
      channelType.addEventListener)
    ) {
      throw("Channel receiving messages must be object with addEventListener method")
    }
  }


}

export default KeyperBridge;
