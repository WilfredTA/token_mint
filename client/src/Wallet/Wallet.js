
import React from 'react';
import ReactDOM from 'react-dom';
import '../App.css';


function Wallet({container, walletRef, display}) {
  const child = (
    <iframe
      className={ display ? "visible":"hidden" }
      ref={walletRef}
      id="wallet"
      src="http://localhost:3001"
      title="Wallet"
    ></iframe>
  );

  return ReactDOM.createPortal(child, container);
}

export default Wallet;
