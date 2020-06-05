import dotenv from "dotenv"
import redis from "redis";
import * as path from "path";
import * as fs from "fs";
const resultEnv = dotenv.config()
const client = redis.createClient();


client.on('connect', () => {
  client.flushall((err, reply) => {
    if (err) {
      console.log(err)
    } else {
      console.log(reply)
    }
  })
  if (fs.existsSync('chain_deps.json')) {
    fs.unlinkSync('chain_deps.json')
  }
  if (fs.existsSync('tx_log.json')) {
    fs.unlinkSync("tx_log.json")
  }
  client.quit(() => {
    console.log("Successfully cleared")
  })
})
