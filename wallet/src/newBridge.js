const {KeyperBridge, SendChannel, ReceiveChannel} = require("keyper-bridge");


function create(sendChannel, receiveChannel, wallet=null) {
  let serialization = {
    serialize: (obj) => {
      return JSON.stringify(obj)
    },
    deserialize: (string) => {
      return JSON.parse(string)
    }
  }
  const senderChannel = new SendChannel(sendChannel, "postMessage", serialization, ["*"])
  const receiverChannel = new ReceiveChannel(receiveChannel, "addEventListener", "removeEventListener", "message", "data", serialization)

  const walletMethodsMap = {
    "sendTx": {
      returnMessage: "return_signed_tx",
      fields: ["signedTx", "queryParam"]
    },
    "accounts": {
      returnMessage: "return_accounts",
      fields: []
    }
  }
  let bridge = new KeyperBridge(senderChannel, receiverChannel, walletMethodsMap, wallet)
  return bridge
}

export default create;
