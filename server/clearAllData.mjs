import dotenv from "dotenv"
import redis from "redis";
import * as path from "path";
import * as fs from "fs";
const resultEnv = dotenv.config()
const redisPrefix = resultEnv.parsed.REDIS_PREFIX
const client = redis.createClient({prefix: redisPrefix});


// Delete chain_deps cache.
console.log('Deleting chain_deps.json.')
if (fs.existsSync('chain_deps.json')) {
  fs.unlinkSync('chain_deps.json')
}

// Delete transaction log.
console.log('Deleting tx_log.json.')
if (fs.existsSync('tx_log.json')) {
  fs.unlinkSync("tx_log.json")
}

client.on("ready", function() {
  // Delete all existing keys starting with prefix.
  client.keys(`${redisPrefix}*`, (err, rows) => {
    if (err) {
      console.log(err)
    } else {
      console.log(`Deleting ${rows.length} Redis keys.`)
      rows.forEach((row) => {
        // console.log(`Deleting Redis Key: ${row}`)
        // Remove prefix from key since the client adds it back in because {prefix} was set on connect.
        const key = row.substr(redisPrefix.length)
        client.del(key)
      })
    }

    client.quit(() => {
      console.log("Successfully cleared.")
    })
  })
})
