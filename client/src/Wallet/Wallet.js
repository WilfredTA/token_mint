
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import logo from '../logo.png';
import '../App.css';
import axios from 'axios';
import Loader from 'react-loader-spinner';




function Wallet({ container, walletRef, display}) {
  let [loading, setLoading] = useState(true)

    let child = (
    <iframe
      className={ display ? "visible":"hidden" }
      ref={walletRef}
      id="wallet"
      src="http://localhost:3001"></iframe>
    )



    return (
       ReactDOM.createPortal(child, container)
   )

}

export default Wallet
