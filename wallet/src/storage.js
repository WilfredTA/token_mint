

function Store({name}) {
  this.name = name;
  this.get = (key) => {
    let val = localStorage.getItem(key)
    if (val) {
      return JSON.parse(localStorage.getItem(key))
    } else {
      return undefined
    }
  }
  this.set = (key, val) => {
    return localStorage.setItem(key, JSON.stringify(val))
  }
}

const KEYPER_DATA_NAME = "keyper";

const stores = {};

const getStore = (name) => {
  if (!stores.hasOwnProperty(name)) {
    stores[name] = new Store({ name});
  }

  return stores[name];
};

const keyperStorage = () => getStore(KEYPER_DATA_NAME);

const getSalt = () => {
  return keyperStorage().get("salt") || "SALT_ME";
};

module.exports = {
  getStore,
  keyperStorage,
  getSalt,
};
