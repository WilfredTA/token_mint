#!/usr/bin/env bash

npm i --prefix "server/deps/ckb-js-toolkit-contrib" && \
npm run build --prefix "server/deps/ckb-js-toolkit-contrib" && \
cd server/deps/ckb-miscellaneous-scripts && \
rm -rf build && \
mkdir build && \
make all-via-docker && \
cd - && \
npm i --prefix "server" && \
npm run build --prefix "server" && \
npm i --prefix "client/deps/keyper-bridge" && \
npm run build --prefix "client/deps/keyper-bridge" && \
npm i --prefix "client" && \
npm i --prefix "wallet/deps/keyper-bridge" && \
npm run build --prefix "wallet/deps/keyper-bridge" && \
npm i --prefix "wallet/deps/keyper-web-wallet/packages/wallet/deps/keyper/packages/container" && \
npm i --prefix "wallet/deps/keyper-web-wallet/packages/wallet/deps/keyper/packages/specs" && \
npm i --prefix "wallet/deps/keyper-web-wallet/packages/wallet/deps/keyper" && \
npm i --prefix "wallet/deps/keyper-web-wallet/packages/wallet" && \
npm i --prefix "wallet/deps/keyper-web-wallet" && \
npm i --prefix "wallet" && \
npm run build --prefix "wallet/deps/keyper-web-wallet/packages/wallet/deps/keyper/packages/container" && \
npm run build --prefix "wallet/deps/keyper-web-wallet/packages/wallet/deps/keyper/packages/specs" && \
npm run build --prefix "wallet/deps/keyper-web-wallet/packages/wallet/deps/keyper" && \
npm run build --prefix "wallet/deps/keyper-web-wallet/packages/wallet" && \
npm run build --prefix "wallet/deps/keyper-web-wallet" && \
npm run build --prefix "wallet" && \
echo "Dependencies installed successfully."
