import { expose } from "threads/worker"
const { proxyWallet } = require("@keyper-web-wallet/wallet")

let walletModule = proxyWallet()

expose(walletModule)
