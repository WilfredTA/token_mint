import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import './App.css';
import logo from './logo.png';
import Loader from 'react-loader-spinner';
import { spawn, Thread, Worker } from "threads"
import create from "./newBridge.js"
import { deleteDB } from 'idb'

const PARENT_ORIGIN = "http://localhost:3000"


function EnterPassword({handleSubmit, handleCancel}) {
  let [password, setPassword] = useState("")
  let [confirmPassword, setConfirmPassword] = useState("")

  const handlePwChange = (e) => {
    setPassword(e.target.value)
  }

  const handleConfirmPwChange = (e) => {
    setConfirmPassword(e.target.value)
  }

  const handlePwSubmit = (e) => {
    e.preventDefault()
    setPassword("")
    setConfirmPassword("")
    if (password !== confirmPassword) {
      alert("Passwords must match!")
    } else {
      handleSubmit(password)
    }
  }

  return (
    <form onSubmit={handlePwSubmit}>
      <label>
        Enter Password
        <input type="password" value={password} onChange={handlePwChange} />
      </label>
      <label>
        Confirm Password
        <input type="password" value={confirmPassword} onChange={handleConfirmPwChange} />
      </label>
      <input className="submitter" type="submit" value="Submit" />
      <button onClick={handleCancel}> Cancel </button>
    </form>
  );

}


function EnterKey({handleSubmit, handleCancel}) {
  const [key, setKey] = useState("")

  const handleKeyChange = (e) => {
    setKey(e.target.value)
  }

  const handleKeySubmit = (e) => {
    e.preventDefault()
    handleSubmit(key)
  }
  return (
    <form onSubmit={handleKeySubmit}>
      <label>
        Enter Key
        <input type="text" value={key} onChange={handleKeyChange} />
      </label>
      <input className="submitter" type="submit" value="Submit" />
      <button onClick={handleCancel}> Cancel </button>
    </form>
  );
}

/**
 * Normalizes the private key specified by the user for import.
 */
function sanitizeKey(key) {
  let sanitizedKey = key;

  // Remove all whitespace.
  sanitizedKey = sanitizedKey.replace(/\s+/g, "");

  // Remove leading "0x" if present.
  if(sanitizedKey.length > 2 && sanitizedKey.substr(0, 2) === "0x")
    sanitizedKey = sanitizedKey.substr(2);

  return sanitizedKey;
}



// create
// choose -> password -> keygen
// import
// choose -> password -> keyimport
// Unlock
// password



const WALLET_STEPS = {CHOOSE: "choose", PASSWORD: "password", KEYGEN: "keygen", IMPORT: "import", SUBMIT: "submit", VERIFY:"verify", SIGN: "sign"}
const WORKFLOWS = {
  UNLOCK: [WALLET_STEPS.CHOOSE, WALLET_STEPS.VERIFY, WALLET_STEPS.SUBMIT],
  CREATE: [WALLET_STEPS.CHOOSE, WALLET_STEPS.PASSWORD, WALLET_STEPS.KEYGEN, WALLET_STEPS.SUBMIT],
  IMPORT: [WALLET_STEPS.CHOOSE, WALLET_STEPS.PASSWORD, WALLET_STEPS.IMPORT, WALLET_STEPS.SUBMIT],
  SIGN: [WALLET_STEPS.PASSWORD, WALLET_STEPS.SIGN]
}

function WalletComponent() {
  let [walletWorkflow, setWalletWorkflow] = useState(null)
  let [walletStep, setWalletStep] = useState(0)
  let [password, setPassword] = useState("")
  let [displayLoad, setDisplayLoad] = useState(false)
  let [displayInitialLoad, setDisplayInitialLoad] = useState(true)
  let [txsToSign, setTxsToSign] = useState({})
  let [bridge, setBridge] = useState(null)
  let [longCommand, setLongCommand] = useState(null)
  let [keyToImport, setKeyToImport] = useState(null)

  let [wallet, setWallet] = useState(null)
  let prevStepRef = useRef()
  let walletExistsRef = useRef(null)
  let currStepRef = useRef(0)
  let boundSignCb = useRef(false)
  let txToSignRef = useRef(null)
  let walletRef = useRef(null)

  useLayoutEffect(() => {
    const loadWallet = async () => {
      console.log(wallet, "<< WALLET")
      if (!wallet) {

        const webWallet = await spawn(new Worker("./walletWorker.js"))
        console.log(webWallet, "<< WALLET CREATED")
        await webWallet.addLockScripts()
        // let lockhashesWithMeta = await webWallet.getAllLockHashesAndMeta()
        // let accountsRet = await webWallet.accounts()

        // console.log(lockhashesWithMeta, "<< META AND LOCK INSIDE WALLET COMPONENT")
        // console.log(accountsRet, "<< ACCOUNTS INSIDE WALLET COMPONENT")
        walletRef.current = webWallet
        setWallet(webWallet)

        let walletBridge = create(window.parent, window, webWallet)
        setBridge(walletBridge)
      }
    }
    loadWallet()
  },[wallet])

  const step = () => {
    currStepRef.current = currStepRef.current + 1
    setWalletStep(walletStep + 1)
  }

  useEffect(() => {
    const executeLongCommand = async () => {
      setLongCommand(null)
      if (longCommand === WALLET_STEPS.KEYGEN) {
        console.log("EXECUTING LONG COMMAND")
        await wallet.generateKey(password)
        setDisplayLoad(false)
        step()
      } else if (longCommand === WALLET_STEPS.SIGN) {
        let {lockHash, rawTx, config} = txsToSign
        let {id} = txsToSign
        let result = await wallet.signTx(lockHash, password, rawTx, config)
        setTxsToSign({})
        bridge.send('return_signTx', result, id)
      } else if (longCommand === WALLET_STEPS.IMPORT) {
        const sanitizedKey = sanitizeKey(keyToImport);
        let pubkey = await wallet.importKey(sanitizedKey, password)
        setDisplayLoad(false)
        setKeyToImport(false)
        step()
      }
    }

    const processLongCommand = async () => {
      if (longCommand !== null) {
        await executeLongCommand()
      }
    }
    processLongCommand()
  }, [longCommand, walletStep, password, step])

  useEffect(() => {

    if (bridge) {
      bridge.onMessage("signTx", (message) => {
        console.log(message, "RECEIVED SIGN REQ")
        setTxsToSign({...message.payload, id: message.messageId})
        setWalletStep(0)
        setWalletWorkflow(WORKFLOWS.SIGN)
      })
    }

  }, [bridge])

  useEffect(() => {

    let check = async () => {
      if (!walletExistsRef.current && walletRef.current) {
        let recent;
        if (!wallet) {
          recent = await walletRef.current.exists()

        } else {
          let accountsret = await wallet.accounts()
          console.log(accountsret, "<< ACCS")
          recent = await wallet.exists()
          walletExistsRef.current = recent
          setDisplayInitialLoad(false)
        }

      }
    }
    check()

  })

  useEffect(() => {
    if (walletExistsRef.current != null && displayInitialLoad === true ) {
      setDisplayInitialLoad(false)
    }
  }, [displayInitialLoad])

  useEffect(() => {
    prevStepRef.current = walletStep
  })


  useEffect(() => {
    if (walletWorkflow && walletWorkflow[currStepRef.current] == WALLET_STEPS.SUBMIT){
      bridge.send('wallet_ready', "", "*")
      setWalletStep(0)
      setWalletWorkflow(null)
    }

  }, [walletStep, walletWorkflow])

  const prevStep = prevStepRef.current



  const getCurrStep = () => {
    let current = prevStep
    if (!walletWorkflow) {
      return WALLET_STEPS.CHOOSE
    }
    return walletWorkflow[walletStep]
  }
  const handleImportClick = async () => {
    setWalletWorkflow(WORKFLOWS.IMPORT)
    step()
  }
  const handleCreateClick = async () => {
    setWalletWorkflow(WORKFLOWS.CREATE)
    step()

  }
  const handlePwSubmit = async (pw) => {
    let alreadyExists = await wallet.exists()
    if (!alreadyExists) {
      await wallet.createPassword(pw)
    } else {
      let correctPw = await wallet.unlock(pw)
      if (!correctPw) {
        return alert("Incorrect Password!")
      }
    }
    setPassword(pw)
    step()
  }

  const handlePwVerify = async (pw) => {
    setPassword(pw)
    let unlock = await wallet.unlock(pw)
    if (unlock) {
      step()
    } else {
      alert("Incorrect Password!")
    }
  }

  const handlePwForSig = async (pw) => {
    try {

      let correctPw = await wallet.unlock(pw)
      if (!correctPw) {
        return alert("Incorrect Password!")
      }
      setPassword(pw)

      setDisplayLoad(true)
      setLongCommand(WALLET_STEPS.SIGN)

    } catch(e) {
        alert("Error in sign!")
        console.log(e)
    }
  }

  const handleResetClick = (e) => {
    const confirmed = window.confirm("Are you sure you want to reset your wallet data?")
    if(confirmed)
    {
      deleteDB("web-wallet", ()=>{alert("blocked")})
      setWalletWorkflow(WALLET_STEPS.CHOOSE)
      window.location.reload();
    }
  }

  const handleUnlockClick = (e) => {
    setWalletWorkflow(WORKFLOWS.UNLOCK)
    step()
  }

  const handleCancel = (e) => {
    e.preventDefault()
    setWalletStep(walletStep - 1)
  }

  const handleKeyGen = async (e) => {
    setDisplayLoad(true)
    // console.log("GENERATING KEY")
    // await wallet.generateKey(password)
    // console.log("keygen complete")
    setLongCommand(WALLET_STEPS.KEYGEN)
  }

  const handleImport = async (key) => {
    setKeyToImport(key)
    setLongCommand(WALLET_STEPS.IMPORT)
    setDisplayLoad(true)

  }

  let toRender = (
    <div className="button-container">
      <div className="button" onClick={handleImportClick}> Import Key </div>
      <div className="button" onClick={handleCreateClick}> Create New Wallet </div>
      <div className="button" onClick={handleUnlockClick}> Unlock Wallet </div>
      <div className="button" onClick={handleResetClick}> Reset Wallet </div>
    </div>
  )

  if (displayInitialLoad === true) {
    toRender = (
      <Loader type="ThreeDots" color="#2BAD60" height="100" width="100" />
    )
  }

  if (walletExistsRef.current === true) {
    toRender = (
      <div className="button-container">
        <div className="button" onClick={handleUnlockClick}> Unlock Wallet </div>
        <div className="button" onClick={handleImportClick}> Import Key </div>
        <div className="button" onClick={handleCreateClick}> Create New Wallet </div>
        <div className="button" onClick={handleResetClick}> Reset Wallet </div>
      </div>
    )
  } else {
    toRender = (
      <div className="button-container">
        <div className="button" onClick={handleImportClick}> Import Key </div>
        <div className="button" onClick={handleCreateClick}> Create New Wallet </div>
      </div>
    )
  }
  if (getCurrStep() === WALLET_STEPS.PASSWORD) {
    toRender = (
      <div className="password-form-container">
        <EnterPassword handleSubmit={handlePwSubmit} handleCancel={handleCancel} />
      </div>
    )
  }

  if (getCurrStep() === WALLET_STEPS.PASSWORD && Object.keys(txsToSign).length > 0){
    toRender = (
      <div className="password-form-container">
        <EnterPassword txRef={txToSignRef} handleSubmit={handlePwForSig} handleCancel={handleCancel} />
      </div>
    )
  }

  if (getCurrStep() === WALLET_STEPS.VERIFY) {
    toRender = (
      <div className="password-form-container">
        <EnterPassword handleSubmit={handlePwVerify} handleCancel={handleCancel} />
      </div>
    )
  }

  if (getCurrStep() === WALLET_STEPS.KEYGEN) {
    toRender = (
    <div className="button-container">
     <div className="button" onClick={handleKeyGen}> Generate Key</div>
    </div>
   )
 }

  if (getCurrStep() === WALLET_STEPS.IMPORT) {
    toRender = (
      <div className="password-form-container">
        <EnterKey handleSubmit={handleImport} handleCancel={handleCancel} />
      </div>
    )
  }
  return (
    <div className="Wallet">
      <header className="Wallet-header">
        <img src={logo} className="Wallet-logo" alt="logo" />
          {toRender}
          {displayLoad && <Loader type="ThreeDots" color="#2BAD60" height="100" width="100" />}
      </header>
    </div>
  )
}

export default WalletComponent
