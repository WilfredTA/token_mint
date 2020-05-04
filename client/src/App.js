import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import logo from './logo.png';
import './App.css';
import axios from 'axios';
import Loader from 'react-loader-spinner';
import Wallet from './Wallet/Wallet.js'
import create from "./newBridge.js"

import * as utils from './utils.js'
const {
  packUdtAmount,
  unpackUdtAmount
} = utils

const WALLET_ORIGIN = "http://localhost:3001"

function UDTDefinitionCellStatus(props) {
  console.log(props, "<< props")
  let { cell } = props
  let status_message = (<span className="Error">Not Found</span>)
  if (cell && cell.cell_output) {
    status_message = (<span className="Success">Deployed</span>)
  }
    return (
      <div className="nervos-green-border">
        <p>UDT Code Cell Status: {status_message}</p>
      </div>
    )
}


function DeployCodeButton({buttonType, lockHash, cb, message, address}) {
  console.log(lockHash, "<< DEPLOY CODE PROPS")
  const clickCb = async () => {
    if (buttonType === "deploy") {
      axios.post('/udts', {
        lockHash,
        address
      })
      .then((response) => {
        console.log(response, "<< RESPONSE FROM DEPLOY CODE BUTTON")
        cb(response.data.rawTx)
      })
      .catch(e => {
        console.log(e)
        throw e
      })
    } else {
      cb()
    }
  }

  return (
    <div className="submitter toggle-button" onClick={clickCb}><p>{message}</p></div>
  )
}

function UDTDefinitionCellInfo(props) {
  let { cell } = props

    return (
      <div className="nervos-green-border">
        <p>Transaction Hash: {cell.out_point.tx_hash}</p>
        <p>Transaction Index: {cell.out_point.index}</p>
        <p>Capacity: {parseInt(cell.cell_output.capacity)}</p>
      </div>
    )
}

function CreateUDTForm({submitCb, inputCb, supply, accounts}) {
    let [govAccount, setGovAccount] = useState(null)
    let [currOwner, setCurrOwner] = useState(null)

    useEffect(() => {
      if (accounts.length > 0) {
        setGovAccount(accounts[0])
        setCurrOwner(accounts[0])
      }
    }, [accounts])


    let options = () => {
      console.log(accounts, "<< ACCOUNTS")
      return accounts.map((account) => {
        return (
          <option value={account.address}

          >{account.address}</option>
        )
      })
    }


    const handleSubmit = async (e) => {
        axios.post('/udts/instances', {
          govAddress: govAccount.address,
          address: currOwner.address,
          supply
        })
        .then((response) => {
          console.log(response, "<< RESPONSE FROM DEPLOY UDT FORM")
          submitCb(response.data.rawTx, govAccount)
        })
        .catch(e => {
          console.log(e)
          throw e
        })
    }

    const onSubmit = (e) => {
      e.preventDefault()
      handleSubmit()
    }

    const handleChange = (e) => {
      inputCb(e)
    }


    const onSelectInputChange = (e) => {
      let targetAccount = accounts.find((acc) => {
        return acc.address === e.target.value
      })
      setGovAccount(targetAccount)
    }

    const onSelectOwnerChange = (e) => {
      let targetAccount = accounts.find((acc) => {
        return acc.address === e.target.value
      })
      setCurrOwner(targetAccount)
    }
    return (
      <form onSubmit={onSubmit}>
        <label>
          Enter Total Supply:
          <input type="text" value={supply} onChange={handleChange} />
        </label>
        <label> Select Governance Account </label>
        <br />
        {accounts &&
          <select onChange={onSelectInputChange}className="select-menu" name="gov-select">
            {options()}
          </select>
        }
        <label> Select Owner Account </label>
        <br />
        {accounts &&
          <select onChange={onSelectOwnerChange}className="select-menu" name="gov-select">
            {options()}
          </select>
        }
        <input className="submitter" type="submit" value="Submit" />
      </form>
    );
}


function TokenCell({cell, accounts, type}) {
  const getGovernorFor = (cell) => {
    const govLockHash = cell.asCell.type.args
    const govAccount = accounts.find((acc) => {
      return acc.lock === govLockHash
    })
    return govAccount.address
  }

  if (type && type.name === "account") {
    return (
      <div className="cell">
        <p><b>Address:</b> {type.account.address}</p>
        <p><b>CKByte Balance:</b> {type.account.amount}</p>
      </div>
    )
  } else {
    return (
      <div className="cell">
        <p><b>Amount:</b> {parseInt(unpackUdtAmount(cell.asCell.data))}</p>
        {cell.account && <p><b>Lock Type: </b> {cell.account.type} </p>}
        {cell.account && <p><b>Owner: </b> {cell.account.address} </p>}
        {cell.account && <p><b>Governor: </b> {getGovernorFor(cell)} </p>}
      </div>
    )
  }

}

function TokenCells({cells, accounts, displayLoad}) {
  const [displayType, setDisplayType] = useState("tokens")
  let tokenIds = {}
  cells.forEach((cell) => {
    let {typeHash} = cell
    if (tokenIds[typeHash]) {
      tokenIds[typeHash].push(cell)
    } else {
      tokenIds[typeHash] = [cell]
    }
  })

  const tokensForId = (id) => {
    return tokenIds[id].map((cell) => {
      return (
        <TokenCell cell={cell} accounts={accounts} />
      )
    })
  }
  const totalBalance = (id) => {
    let balance = 0;
    tokenIds[id].forEach((token) => {

      balance += parseInt(unpackUdtAmount(token.asCell.data))
    })
    return balance
  }

  const getGovernancePermissions = (id) => {
    let testToken = tokenIds[id][0]
    let account = testToken.account
    if (account.lock === testToken.asCell.type.args) {
      return "Yes"
    }
    return "No"
  }
  const typeGroups = Object.keys(tokenIds).map((id) => {
    return (
      <React.Fragment>
        <h2 className="cell-type-title">Token Type: {id.substring(0,10)}</h2>
        { tokenIds[id][0].account && <p>Governance Permissions: {getGovernancePermissions(id)} </p>}
        {tokensForId(id)}
        <p> Total Balance: {totalBalance(id)} </p>
        </React.Fragment>
    )
  })
  const accountsDisplay = accounts.map((acc) => {
    return (
      <React.Fragment>
        <TokenCell type={{name: "account", account: acc}} />
      </React.Fragment>
    )
  })

  const toggleView = (mode) => {
    return () => {
      setDisplayType(mode)
    }
  }

  if (displayType === "tokens") {
    return (
      <div className="cells-container">
        <h1><span className="active toggle">My Tokens</span> &nbsp; &nbsp;<span
          className="toggle"
          onClick={toggleView("accounts")}
        > My Accounts </span></h1>
        {!displayLoad && typeGroups}
        {displayLoad && <Loader type="ThreeDots" color="#2BAD60" height="100" width="100" />}
      </div>
    )
  } else if (displayType === "accounts") {
    return (
      <div className="cells-container">
        <h1><span
          className="toggle"
          onClick={toggleView("tokens")}
        >My Tokens</span> &nbsp; &nbsp;<span className="active toggle"> My Accounts </span></h1>
        {accountsDisplay}
      </div>
    )
  }

}


function App() {

  const [udtDefs, setUdtDefs] = useState({defs: []})
  const [displayCodeInfo, setDisplayCodeInfo] = useState(false)
  const [displayLoad, setDisplayLoad] = useState(true)
  const [tokens, setTokens] = useState([])
  const [formSupply, setFormSupply] = useState(0)
  const [txToSign, setTxToSign] = useState(null)
  const [displayWallet, setDisplayWallet] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [bridge, setBridge] = useState(null)
  const [fetchTokens, setFetchTokens] = useState(true)
  const [newAccounts, setNewAccounts] = useState(false)
  const [displayTokenLoad, setDisplayTokenLoad] = useState(false)

  let bridgeRef = useRef(null)
  let walletRef = useRef(null)
  let hasDeployedCodeCell = useRef(false)

  useEffect(() => {
    let timeout = null;
    const getTokens = async () => {
      try {
        let res = await axios.get("/udts/instances")

        let tokensReturned = res.data.tokens
        console.log(tokensReturned, "<< TOKENS RETURNED")
        tokensReturned = tokensReturned.map((token) => {
          let newToken = Object.assign({}, token)
          let {lockHash} = token
          let tokenAccount = accounts.filter((acc) => {
            return acc.lock === lockHash
          })[0]

          newToken.account = tokenAccount
          return newToken
        })

        if (tokensReturned.length > tokens.length) {
          setDisplayTokenLoad(false)
          setFetchTokens(false)
        }
        setTokens(tokensReturned)

      } catch(e) {
          console.log(e)
      }
    }

    if (fetchTokens) {
      getTokens()
      let interval = setInterval(getTokens, 5000)
      return () => {
        clearInterval(interval)
      }
    }


  }, [fetchTokens, accounts, displayTokenLoad])


  useEffect(() => {
    const getUDTDepStatus = async () => {
      try {
        let response = await axios.get('/udts')
        if (response.status === 200 ) {
          updateDefs(response.data.cell)
          return response
        } else {
          return null
        }
      } catch(e) {
        console.log(e)
      }

    }



    if (udtDefs.defs.length === 0) {
      let inter = setInterval(async () => {
        await getUDTDepStatus()
        if (hasDeployedCodeCell.current === false) {
          setDisplayLoad(false)
        }
      }, 5000)


      return () => {
        clearInterval(inter)
      }
    } else {
      setDisplayLoad(false)
      hasDeployedCodeCell.current = true
    }

  }, [udtDefs])

  useEffect(() => {
    const requestAccounts = async () => {
      let loadedAccounts = await bridge.accounts()
      console.log(loadedAccounts, "<< ACCOUNTS RECEIVED FROM TEST BRIDGE")
      let accountMap = {}
      let lockHashes = loadedAccounts.map((acc) => {
        accountMap[acc.lock] = 0
        return {lock: acc.lock, address: acc.address}
      })
      let balanceResult = await axios.post('/balances', {
        lockHashes
      })
      balanceResult.data.balances.forEach((balance) => {
        accountMap[balance.lock] = balance.capacity
      })
      let toSetAccounts = loadedAccounts.map((acc) => {
        return {...acc, amount: accountMap[acc.lock]}
      })

      if (toSetAccounts.length !== accounts.length) {
        setAccounts(toSetAccounts)
        setFetchTokens(true)
        setNewAccounts(false)
      }
    }
    if (bridge && newAccounts) {
      requestAccounts()
      let interval = setInterval(requestAccounts, 3000)
      return () => {
        clearInterval(interval)
      }
    }

  }, [accounts, bridge, newAccounts])


  useLayoutEffect(() => {


    const initialSetup = async () => {
      let iframe = document.getElementById("wallet").contentWindow

      let clientBridge = create(iframe, window)

      setBridge(clientBridge)

      bridgeRef.current = clientBridge

      clientBridge.onMessage("wallet_ready", async () => {
        setNewAccounts(true)
        clientBridge.addKeyperClientMethod("signTx", ["lockHash", "rawTx", "config"])
        setDisplayWallet(false)
      })
    }
    if (!bridge) {
      initialSetup()
    }

  },[bridge])


  const deployCodeCb = async (rawTx) => {
    setDisplayLoad(true)
    setTxToSign(rawTx)
    console.log(rawTx, "<< TX TO SIGN")
    setDisplayWallet(true)
    let signedTx = await bridge.signTx({lockHash: accounts[0].lock, rawTx, config: {index: 0, length: -1}})
    console.log(signedTx, "<< SIGNED TX")
    let result = bridge.sendTx({signedTx, queryParam: "?type=deploy_code"})
    hasDeployedCodeCell.current = true
    console.log(result, "<< RESULT OF SEND TX")
    setDisplayWallet(false)
    setTxToSign(null)
    setDisplayLoad(true)

  }



  const updateDefs = (cell_data) => {
    setUdtDefs({defs: [cell_data]})
  }

  const toggleCodeInfoDisplay = () => {
    setDisplayCodeInfo(!displayCodeInfo)
  }
  const handleTokenSubmit = async (rawTx, account) => {
    setTxToSign(rawTx)
    console.log(rawTx, "<< TX TO SIGN")
    setDisplayWallet(true)
    let signedTx = await bridge.signTx({lockHash: account.lock, rawTx, config: {index: 0, length: -1}})
    let result = bridge.sendTx({signedTx, queryParam: "?type=deploy_instance"})
    setTxToSign(null)
    setDisplayWallet(false)
    setDisplayTokenLoad(true)
    setFetchTokens(true)
  }

  const handleSupplyFormChange = (e) => {
    let new_supply = e.target.value
    setFormSupply(new_supply)
  }

  let toRender = null

  if (!udtDefs.defs.length) {
    toRender = (
      <div>
        <UDTDefinitionCellStatus cell={udtDefs.defs[0]}/>
        <DeployCodeButton lockHash={accounts[0] ? accounts[0].lock : ''} address={accounts[0] ? accounts[0].address : ''} cb={deployCodeCb} buttonType="deploy" message="Deploy UDT Code Cell"/>
      </div>
    )
  } else {
    toRender = (
      <div>
        <UDTDefinitionCellStatus cell={udtDefs.defs[0]}/>
        {displayCodeInfo
          && <UDTDefinitionCellInfo cell={udtDefs.defs[0]} />
        }
        {displayCodeInfo
         ?   <DeployCodeButton
             cb={toggleCodeInfoDisplay}
             buttonType="view"
             message="Hide UDT Info"
           />
          :   <DeployCodeButton
              cb={toggleCodeInfoDisplay}
              buttonType="view"
              message="Display UDT Info"
            />
        }
      </div>
    )
  }

    return (
      <div className="App">
       <Wallet display={displayWallet} walletRef={walletRef} container={document.getElementById('wallet-root')}/>
      {
        !displayWallet &&
          <React.Fragment>
          <header className="App-header" >
            <img src={logo} className="App-logo" alt="logo" />
            <p>
              Token Portal
            </p>
          </header>
          <div className="toggle-cell">
            {toRender}
            {
              displayLoad
              &&
              <Loader type="ThreeDots" color="#2BAD60" height="100" width="100" />
            }
        </div>
        <div className="token-form-container">
          <h3> Deploy a Token </h3>
          <CreateUDTForm
            accounts={accounts}
            submitCb={handleTokenSubmit}
            inputCb={handleSupplyFormChange}
            supply={formSupply} />

        </div>
        { accounts.length && <TokenCells cells={tokens} accounts={accounts} displayLoad={displayTokenLoad} /> }
        </React.Fragment>
      }
      </div>

    );

}

export default App;
