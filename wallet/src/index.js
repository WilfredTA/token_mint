import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import WalletComponent from './WalletComponent';
var Buffer = require('buffer/').Buffer
window.Buffer = Buffer


ReactDOM.render(
  <React.StrictMode>
    <WalletComponent />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
