
![Preview](demo_assets/dapp_wallet.png)

# Introduction
This is a demo application for working with User Defined Tokens (UDTs) on Nervos Network's Layer 1 Blockchain, Common Knowledge Base.

I will provide setup instructions soon.


This is an overview of the architecture:

![Architecture](demo_assets/Dapp_Design.png)

## Client and wallet

`/client` contains a react app that provides the main dapp interface. The app provided by client
renders a second app - the browser wallet - inside an iframe. The browser wallet is located in `/wallet`.

The browser wallet is built to [Keyper](https://github.com/ququzone/keyper) compatible (more on Keyper later). For now, just know that Keyper is an interface specification that allows dapps and wallets to easily communicate in a way that simplifies the complexity of dealing with the high flexibility of possible ownership models on CKB. It is called an "ownership" layer for this reason... Check out the Keyper home page [here](https://github.com/ququzone/keyper).

The iframe-based wallet app located in `/wallet` spawns a web worker that implements a Keyper web wallet. The initialization of the web wallet is located in `/wallet/src/walletWorker.js`. For convenience, I've placed the source code for the wallet instantiated by the `walletWorker` in a top level directory: `/keyper-web-wallet`.

You may notice that `keyper-web-wallet` has other packages, `bridge` and `script`. That is because `keyper-bridge` is generic enough to support other types of wallets, e.g., desktop wallets that communicate with the dapp through web sockets (such as `keyper-scatter`). Due to this, I'd like to extract some of the `keyper-bridge` logic used by the `/wallet` app into a separate package that can be more easily used alongside the web wallet.

There is also a package in `keyper-web-wallet` called `contracts`. This is a placeholder for both the on-chain scripts (or "smart contracts") relevant to user defined tokens as well as for the keyper `LockScript` interface that will enable keyper wallets to use these contracts out of the box. For example, an issuance contract that locks new UDTs in a script that will allow UDTs to be transferred in exchange for some CKByte rate, as well as the corresponding keyper `LockScript`, will go in here.

*Both the `bridge` and `contracts` packages are empty right now, but I plan to add to them soon*

The final portion of the client-side application is a small module you'll find as a dependency in both the client and wallet apps: `keyper-bridge`. For convenience, I've placed the source code for `keyper-bridge` in the root directory of this repo as well.

Since wallets and dapps need to be isolated from eachother, yet must still communicate, it becomes difficult and tedious to pass around a bunch of messages and use callbacks after callbacks. This is especially the case when you have to coordinate the current status of the wallet with the UI. Keyper-bridge is meant to solve this by encapsulating message passing functionality for bidirectional communication between the app and wallet, and instead exposes a simple interface to work with the wallet, *almost* as if the wallet itself is just another module included in the dapp source code. For example, instead of listening for messages and filtering them based on type, contents, or intended recipient, all the dapp needs to do to coordinate transaction signing with the external wallet is: `await keyperBridge.signTx(tx)`.

## Server

The `/server` directory generates raw transactions for signing on behalf of the client & wallet, and also provides query services specific to this application. In this setup, the server connects to a local CKB node. Although it'd be easy (and often times preferable) to submit signed transactions directly to a node from the dapp, the server provides a nice way to query the chain and filter through data, offloading that burden from client side.

The server makes use of [`ckb-js-toolkit`](https://github.com/xxuejie/ckb-js-toolkit) and [`ckb-js-toolkit-contrib`](https://github.com/xxuejie/ckb-js-toolkit-contrib) developed by CKB core developer Xuejie.

## Demonstration of Functionality
Right now, the dapp allows you to deploy the UDT type script to your local chain, and also allows deploying tokens with governance locks, generating new accounts, and viewing account balances and UDT balances. Once the issuance script is built on the Keyper and CKB blockchain side, it will make it very easy to list custom tokens and their rates, issue them, and exchange CKBytes for UDTs.

Here is a visual demo of some of these functions:

### Deploy Token
![Deploy Token](demo_assets/deploy-token.gif)

### Import Private Key
 ![Import Key](demo_assets/import-key.gif)

### Create New Account
![Create Account](demo_assets/create-account.gif)


### Sign Transaction Workflow
![Sign Transaction Workflow](demo_assets/SignTxTokenMint.png)

# Disclaimer

This is meant for demonstration purposes only. The source code has not undergone a security review and I highly discourage you from using the web wallet in production at this time. Also, I am a reactJS noob, so there are probably issues with the reactJS code as well...

Having said that, I highly *encourage* experimenting with the app, or playing around with the web wallet setup and/or keyper-bridge in your own **toy** projects!
