import * as fs from "fs";

let logs = JSON.parse(fs.readFileSync("tx_log.json"))

logs.transactions.forEach((log, idx) => {
  console.log("TRANSACTION " , idx + 1, "\n")
  console.log("REQ INFO: \n")
  console.log(log.info.method, "\n")
  console.log(log.info.path, "\n")
  console.log(log.info.body, "\n")

  console.log("TX TEMPLATE \n")
  console.log(log.tx.template)

  console.log("Raw TX \n")
  console.log(log.tx.rawTx)
})
