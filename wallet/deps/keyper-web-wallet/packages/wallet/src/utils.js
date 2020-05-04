/* global BigInt */
const { Reader } = require("ckb-js-toolkit");

export function unpackUdtAmount(data) {
  const view = new DataView(new Reader(data).toArrayBuffer());
  const a = view.getBigUint64(0, true);
  const b = view.getBigUint64(8, true);
  return (b << 64n) | a;
}

export function packUdtAmount(amount) {
  const a = amount & BigInt("0xFFFFFFFFFFFFFFFF");
  const b = (amount >> 64n) & BigInt("0xFFFFFFFFFFFFFFFF");
  const view = new DataView(new ArrayBuffer(16));
  view.setBigUint64(0, a, true);
  view.setBigUint64(8, b, true);
  return new Reader(view.buffer);
}

export function hexToBytes(hex) {
  return new Reader(hex).toArrayBuffer()
}
