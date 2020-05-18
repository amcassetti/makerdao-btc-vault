import React from 'react';
import Web3 from 'web3';
import GatewayJS from "@renproject/gateway-js";
import RenSDK from "@renproject/ren";
import AddressValidator from "wallet-address-validator";
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import InputAdornment from '@material-ui/core/InputAdornment';
import LoopIcon from '@material-ui/icons/Loop';
import UndoIcon from '@material-ui/icons/Undo';
import RedoIcon from '@material-ui/icons/Redo';

import DaiLogo from './dai-logo.png'
import ADAPTER_ABI from './proxyABI.json'
import theme from './theme'
import TransactionItem from './TransactionItem'
import { withTheme, withStyles, ThemeProvider } from '@material-ui/core/styles';
import { createStore, withStore } from '@spyna/react-store'

import {
    setDAIAllowance,
    updateWalletData,
    initMonitoring,
    initDeposit,
    removeTx,
    burnDai,
    DAI_ADDRESS
} from './txUtils'

const styles = () => ({
    container: {
        border: '1px solid #eee',
        marginTop: theme.spacing(6),
        borderRadius: 4,
        boxShadow: '0px 0px 30px 0px rgba(0, 0, 0, 0.05)'
    },
    header: {
        textAlign: 'center',
        padding: theme.spacing(2),
        paddingTop: theme.spacing(6),
        '& img': {
            height: 70,
            width: 'auto',
            margin: '0px auto'
        }
    },
    balance: {
        fontSize: 18
    },
    inputField: {
        width: '100%',
        marginBottom: theme.spacing(2),
        '& input': {
            // fontSize: 14
        },
        '& p': {
            // fontSize: 14
        }
    },
    button: {
        width: '100%',
        background: 'linear-gradient(60deg,#ffc826,#fb8c00)',
        boxShadow: 'none',
        minHeight: 54,
        fontSize: 16,
        borderRadius: 8,
        '&:hover': {
            boxShadow: 'none',
        },
        '&.Mui-disabled': {
            background: '#EBEBEB',
        },
        '&.Mui-disabled span': {
            color: '#757575'
        }
    },
    tabs: {
        backgroundColor: '#fafafa',
        margin: '0px auto',
        // borderTopRightRadius: 8,
        // borderTopLeftRadius: 8,
        '& .MuiTab-labelIcon': {
          minHeight: 100
        },
        '& button': {
          borderBottom: '1px solid #eee',
          borderTop: '1px solid #eee'
        },
        '& span.MuiTabs-indicator': {
            backgroundColor: 'transparent'
        },
    },
    section: {
        padding: theme.spacing(2),
    },
    transaction: {
        padding: theme.spacing(2)
    },
    allowances: {
        padding: theme.spacing(2),
        '& button': {
            marginBottom: theme.spacing(2)
        }
    },
    error: {
        paddingTop: theme.spacing(4),
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
        textAlign: 'center'
    }
})

const initialState = {
    'balance': '0.000000',
    'daiAllowance': '',
    'daiAllowanceRequesting': false,
    'zbtcAllowance': '',
    'zbtcAllowanceRequesting': false,
    'zbtcRepayAllowance': '',
    'zbtcRepayAllowanceRequesting': false,
    'web3': null,
    'walletConnected': false,
    'walletNetwork': '',
    'walletDataLoaded': false,
    'showWalletError': false,
    'walletType': '',
    'walletAddress': '',
    'transactions': [],
    'selectedTab': 0,
    'accounts': [],
    'borrowAmount': '',
    'borrowDaiAmount': '',
    'borrowBtcAddress': '',
    'borrowBtcAddressValid': false,
    'repayAmount': '',
    'repayBtcAmount': '',
    'repayAddress': '',
    'btcusd': ''
}

class App extends React.Component {
    constructor(props){
        super(props)
        this.state = {}
        this.borrowDaiRef = React.createRef()
        this.repayDaiRef = React.createRef()
    }

    async componentDidMount(){
        window.Web3 = Web3
        const store = this.props.store

        store.set('sdk', new RenSDK('mainnet'))

        await this.initBrowserWallet.bind(this)()

        const local = localStorage.getItem('transactions')
        if (local) {
            store.set('transactions', JSON.parse(local))
        }

        initMonitoring.bind(this)()
        this.watchWalletData.bind(this)()
    }

    async watchWalletData() {
        await updateWalletData.bind(this)();
        this.props.store.set('walletDataLoaded', true)
        setInterval(() => {
            updateWalletData.bind(this)();
        }, 10 * 1000);
    }

    async initBrowserWallet() {
        let web3Provider;
        const store = this.props.store

        // Initialize web3 (https://medium.com/coinmonks/web3-js-ethereum-javascript-api-72f7b22e2f0a)
        // Modern dApp browsers...
        if (window.ethereum) {
            web3Provider = window.ethereum;
            try {
                // Request account access
                await window.ethereum.enable();
            } catch (error) {
                store.set('showWalletError', true)
                // User denied account access...
                // console.error("User denied account access")
            }
        }
        // Legacy dApp browsers...
        else if (window.web3) {
            web3Provider = window.web3.currentProvider;
        }
        // If no injected web3 instance is detected, fall back to Ganache
        else {
            return store.set('showWalletError', true)
        }

        const web3 = new Web3(web3Provider);
        const walletType = 'browser'
        const accounts = await web3.eth.getAccounts()
        const network = web3.currentProvider.networkVersion

        console.log(web3.currentProvider.networkVersion)

        store.set('web3', web3)
        store.set('walletType', walletType)
        store.set('walletAddress', accounts[0])
        store.set('accounts', accounts)
        store.set('showWalletError', network !== '1')
    }

    async borrow() {
        const { store } = this.props
        const borrowAmount = store.get('borrowAmount')
        const borrowDaiAmount = store.get('borrowDaiAmount')
        const borrowBtcAddress = store.get('borrowBtcAddress')

        const tx = {
            id: String(Math.round(Math.random() * (10 ** 8))),
            type: 'deposit',
            awaiting: 'btc-init',
            source: 'btc',
            dest: 'eth',
            amount: borrowAmount,
            daiAmount: borrowDaiAmount,
            btcAddress: borrowBtcAddress,
            error: false
        }

        initDeposit.bind(this)(tx)
    }

    async repay() {
        burnDai.bind(this)()
    }

    async allowDai() {
        setDAIAllowance.bind(this)()
    }

    render(){
        const { classes, store } = this.props
        const {
            web3,
            borrowAmount,
            repayAmount,
            repayBtcAmount,
            selectedTab,
            balance,
            daiAllowance,
            daiAllowanceRequesting,
            showWalletError,
            walletDataLoaded,
            transactions
        } = store.getState()
        const deposits = transactions.filter(t => (t.type === 'deposit'))
        const deposit = deposits[0]

        const hasDAIAllowance = Number(daiAllowance) > Number(repayAmount)

        const canBorrow = !showWalletError && Number(borrowAmount) > 0.00010001
        const canRepay = !showWalletError && Number(repayBtcAmount) > 0.00010001

        console.log(store.getState())

        return <ThemeProvider theme={theme}><Container maxWidth="xs">
            <div className={classes.container}>
                {showWalletError && <Grid item xs={12} className={classes.error}>
                    {web3 ? 'Please set your wallet to the mainnet network.' : 'Please use a web3 enabled browser.'}
                </Grid>}
                <Grid item xs={12} className={classes.header}>
                    <img src={DaiLogo} />
                    <p className={classes.balance}>{balance} DAI</p>
                </Grid>
                {<Grid item xs={12} className={classes.tabs}>
                    <Tabs
                      orientation="horizontal"
                      variant="fullWidth"
                      textColor="secondary"
                      value={selectedTab}
                      onChange={(event, newValue) => {
                          store.set('selectedTab', newValue)
                          store.set('borrowBtcAddress', '')
                          store.set('borrowBtcAddressValid', false)
                      }}
                    >
                      <Tab label="Borrow DAI" icon={<UndoIcon />} />
                      <Tab label="Repay DAI" icon={<RedoIcon />} />
                    </Tabs>
                </Grid>}
                {deposits.length && selectedTab === 0 ? <Grid item xs={12} className={classes.transaction}>
                    <TransactionItem
                        key={0}
                        store={store}
                        onTxClear={() => {
                            const type = deposit.type
                            const awaiting = deposit.awaiting
                            removeTx(this.props.store, deposit)
                        }}
                        network={'testnet'}
                        tx={deposit}
                        {...deposit} />
                </Grid> : null}
                {selectedTab === 0 && !deposits.length && <Grid className={classes.section} container>
                      <Grid item xs={12}>
                          <TextField
                              className={classes.inputField}
                              variant="outlined"
                              placeholder='BTC Deposit Amount'
                              onChange={(event) => {
                                  const amt = event.target.value
                                  const fee = (amt * 0.001) + 0.00005
                                  const net = Number(amt - fee)
                                  const price = Number(store.get('btcusd'))
                                  const daiAmt = Number((net * price) * 0.3).toFixed(2)
                                  store.set('borrowAmount', amt)
                                  store.set('borrowDaiAmount', daiAmt)
                                  this.borrowDaiRef.current.value = daiAmt
                              }}
                              type='number'
                              InputProps={{
                                  endAdornment: <InputAdornment position="end">
                                      BTC
                                  </InputAdornment>
                              }}
                              inputProps={{ 'aria-label': 'bare' }}/>
                      </Grid>
                      <Grid item xs={12}>
                          <TextField
                              disabled={true}
                              className={classes.inputField}
                              variant="outlined"
                              placeholder='DAI Amount'
                              inputRef={this.borrowDaiRef}
                              onChange={(event) => {
                              }}
                              InputProps={{
                                  endAdornment: <InputAdornment position="end">
                                      DAI
                                  </InputAdornment>
                              }}
                              inputProps={{ 'aria-label': 'bare' }}/>
                      </Grid>
                      <Grid item xs={12}>
                          <TextField
                              className={classes.inputField}
                              variant="outlined"
                              placeholder='Your BTC Address'
                              onChange={(event) => {
                                  const value = event.target.value
                                  store.set('borrowBtcAddress', value)
                                  store.set('borrowBtcAddressValid', AddressValidator.validate(
                                    value,
                                    'BTC'
                                  ))
                              }}/>
                      </Grid>
                      <Grid item xs={12}>
                          <Button
                              disabled={!canBorrow}
                              size='large'
                              fullWidth variant="contained"
                              className={classes.button}
                              color="primary"
                              onClick={this.borrow.bind(this)}>
                            Borrow
                        </Button>
                      </Grid>
                </Grid>}
                {selectedTab === 1 && <Grid className={classes.section} container>
                  <Grid item xs={12}>
                      <TextField
                          disabled={!hasDAIAllowance}
                          className={classes.inputField}
                          variant="outlined"
                          placeholder='DAI Amount'
                          onChange={(event) => {
                              const amt = event.target.value
                              const price = Number(store.get('btcusd'))
                              const btcAmt = Number((amt / price) / 0.3).toFixed(6)
                              store.set('repayAmount', amt)
                              store.set('repayBtcAmount', btcAmt)

                              this.repayDaiRef.current.value = btcAmt
                          }}
                          InputProps={{
                              endAdornment: <InputAdornment position="end">
                                  DAI
                              </InputAdornment>
                          }}
                          inputProps={{ 'aria-label': 'bare' }}/>
                  </Grid>
                  <Grid item xs={12}>
                      <TextField
                          className={classes.inputField}
                          disabled={true}
                          variant="outlined"
                          placeholder='BTC Amount'
                          inputRef={this.repayDaiRef}
                          onChange={(event) => {
                          }}
                          InputProps={{
                              endAdornment: <InputAdornment position="end">
                                  BTC
                              </InputAdornment>
                          }}
                          inputProps={{ 'aria-label': 'bare' }}/>
                  </Grid>
                  <Grid item xs={12}>
                      {!hasDAIAllowance && walletDataLoaded ? <Button disabled={daiAllowanceRequesting}
                          size='large'
                          variant="contained"
                          className={classes.button}
                          color="primary"
                          onClick={this.allowDai.bind(this)}>
                          {daiAllowanceRequesting ? 'Requesting...' : 'Set DAI repay allowance'}
                      </Button> : <Button disabled={!canRepay} size='large' variant="contained" className={classes.button} color="primary" onClick={this.repay.bind(this)}>
                        Repay
                    </Button>}
                  </Grid>
                </Grid>}
            </div>

        </Container></ThemeProvider>
    }
}

const AppComponent = withStore(App)

class AppWrapper extends React.Component {
    constructor(props){
        super(props)
    }

    render(){
        return <AppComponent classes={this.props.classes} />
    }
}

export default createStore(withStyles(styles)(AppWrapper), initialState);
