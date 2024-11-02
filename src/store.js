// store.js
const Store = require('electron-store');

const store = new Store({
    defaults: {
        groqApiKey: null
    }
});

module.exports = store;