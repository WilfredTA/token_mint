const {KeyperBridge, SendChannel, ReceiveChannel} = require("keyper-bridge");


function create(sendChannel, receiveChannel, wallet=null) {
  let serialization = {
    serialize: (obj) => {
      return JSON.stringify(obj)
    },
    deserialize: (string) => {
      try {
        const messageObject = JSON.parse(string);
        if(typeof messageObject === "object" && messageObject.hasOwnProperty("messageSource")) {
          return messageObject;
        }
      }
      catch {
        // console.log(JSON.stringify(string), "<< IGNORED BRIDGE EVENT");
      }
      return {};
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
  return new KeyperBridge(senderChannel, receiverChannel, walletMethodsMap, wallet)
}

export default create;
