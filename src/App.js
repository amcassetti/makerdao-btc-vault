import React from 'react';
import Web3 from 'web3';
import GatewayJS from "@renproject/gateway-js";
import RenSDK from "@renproject/ren";
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
    getDAIAllowance,
    getZBTCAllowance,
    setZBTCAllowance,
    initMonitoring,
    initDeposit,
    initWithdraw,
    removeTx,
    burnDai,
    DAI_ADDRESS
} from './txUtils'

import DAI_ABI from './daiABI.json'

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
    }
})

const initialState = {
    'balance': '0.000000',
    'daiAllowance': '',
    'zbtcAllowance': '',
    'zbtcAllowanceRequesting': false,
    'web3': null,
    'walletType': '',
    'walletAddress': '',
    'transactions': [],
    'selectedTab': 0,
    'accounts': [],
    'borrowAmount': '',
    'borrowEthAddress': '',
    'borrowDart': '',
    'borrowBtcAddress': '2NGZrVvZG92qGYqzTLjCAewvPZ7JE8S8VxE',
    'repayAmount': '',
    'repayAddress': ''
}

class App extends React.Component {
    constructor(props){
        super(props)
        this.state = {}
        this.borrowDaiRef = React.createRef()
    }

    async componentDidMount(){
        window.Web3 = Web3
        const store = this.props.store
        // window.gjs = gatewayJS

        store.set('sdk', new RenSDK('testnet'))

        await this.initBrowserWallet.bind(this)()

        const local = localStorage.getItem('transactions')
        if (local) {
            store.set('transactions', JSON.parse(local))
        }

        initMonitoring.bind(this)()
        this.watchWalletData.bind(this)()


    }

    async updateWalletData() {
        const store = this.props.store

        const web3 = store.get('web3')
        const walletAddress = store.get('walletAddress')

        if (!web3 || !walletAddress) {
            return
        }

        const contract = new web3.eth.Contract(DAI_ABI, DAI_ADDRESS);
        const balance = await contract.methods.balanceOf(walletAddress).call();

        store.set('balance', Number(web3.utils.fromWei(balance)).toFixed(6))

        const daiAllowance = await getDAIAllowance.bind(this)()
        const zbtcAllowance = await getZBTCAllowance.bind(this)()

        store.set('daiAllowance', daiAllowance)
        store.set('zbtcAllowance', zbtcAllowance)
    }

    async watchWalletData() {
        await this.updateWalletData.bind(this)();
        setInterval(() => {
            this.updateWalletData.bind(this)();
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
            this.log("Please install MetaMask!");
        }

        const web3 = new Web3(web3Provider);
        const walletType = 'browser'
        const accounts = await web3.eth.getAccounts()

        await window.ethereum.enable();
        store.set('web3', web3)
        store.set('walletType', walletType)
        store.set('walletAddress', accounts[0])
        store.set('accounts', accounts)

        window.ethereum.on('accountsChanged', (accounts) => {
        })
    }

    async borrow() {
        const { store } = this.props
        const borrowAmount = store.get('borrowAmount')
        const ethAddress = store.get('accounts')[0]
        const btcAddress = store.get('borrowBtcAddress')
        const dart = store.get('borrowDart')

        const tx = {
            id: String(Math.round(Math.random() * (10 ** 8))),
            type: 'deposit',
            awaiting: 'btc-init',
            source: 'btc',
            dest: 'eth',
            amount: borrowAmount,
            error: false
        }

        initDeposit.bind(this)(tx)
    }

    async repay() {
        burnDai.bind(this)()
        // const { repayAmount, accounts, web3, transactions } = this.props.store.getState()
        // const contract = new web3.eth.Contract(ADAPTER_ABI, ADAPTER_ADDRESS)
        // const result = await contract.methods.burnDai(accounts[0], repayAmount)
        // console.log(result)
    }

    async allowZbtc() {
        setZBTCAllowance.bind(this)()
    }

    render(){
        const { classes, store } = this.props
        const {
            borrowAmount,
            repayAmount,
            selectedTab,
            balance,
            daiAllowance,
            zbtcAllowance,
            zbtcAllowanceRequesting,
            transactions
        } = store.getState()
        const deposits = transactions.filter(t => (t.type === 'deposit'))
        const deposit = deposits[0]

        const hasDAIAllowance = Number(daiAllowance) > Number(borrowAmount)
        const hasZBTCAllowance = Number(zbtcAllowance) > Number(borrowAmount)
        const hasAllowances = hasDAIAllowance && hasZBTCAllowance

        const canBorrow = Number(borrowAmount) > 0.00010001
        const canRepay = Number(repayAmount / 10000) > 0.00010001

        console.log(store.getState())

        return <ThemeProvider theme={theme}><Container maxWidth="xs">
            <div className={classes.container}>
                <Grid item xs={12} className={classes.header}>
                    <img src={DaiLogo} />
                    <p className={classes.balance}>{balance} DAI</p>
                </Grid>
                {/*!hasAllowances && <Grid item xs={12} className={classes.allowances}>
                    <Button disabled={false}
                        size='large'
                        variant="contained"
                        className={classes.button}
                        color="primary"
                        onClick={this.repay.bind(this)}>
                        Allow zBTC contact
                    </Button>
                    <Button disabled={false}
                        size='large'
                        variant="contained"
                        className={classes.button}
                        color="primary"
                        onClick={this.repay.bind(this)}>
                        Allow DAI contact
                    </Button>
                </Grid>*/}
                {/*<Grid item xs={12} className={classes.tabs}>
                    <Tabs
                      orientation="horizontal"
                      variant="fullWidth"
                      textColor="secondary"
                      value={selectedTab}
                      onChange={(event, newValue) => {
                          store.set('selectedTab', newValue)
                      }}
                    >
                      <Tab label="Borrow DAI" icon={<UndoIcon />} />
                      <Tab label="Repay DAI" icon={<RedoIcon />} />
                    </Tabs>
                </Grid>*/}
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
                              disabled={!hasZBTCAllowance}
                              className={classes.inputField}
                              variant="outlined"
                              placeholder='BTC Deposit Amount'
                              onChange={(event) => {
                                  const amt = event.target.value
                                  store.set('borrowAmount', amt)

                                  this.borrowDaiRef.current.value = Number((amt * 10000) * 0.66).toFixed(2)
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
                          {/*<TextField
                              className={classes.inputField}
                              variant="outlined"
                              placeholder='Owner BTC Address'
                              onChange={(event) => {
                                  store.set('borrowBtcAddress', event.target.value)
                              }}/>*/}
                      </Grid>
                      <Grid item xs={12}>
                          <TextField
                              disabled={true}
                              className={classes.inputField}
                              variant="outlined"
                              placeholder='DAI Amount'
                              inputRef={this.borrowDaiRef}
                              onChange={(event) => {
                                  store.set('borrowDart', event.target.value)
                              }}
                              InputProps={{
                                  endAdornment: <InputAdornment position="end">
                                      DAI
                                  </InputAdornment>
                              }}
                              inputProps={{ 'aria-label': 'bare' }}/>
                      </Grid>
                      <Grid item xs={12}>
                        {hasZBTCAllowance ? <Button disabled={!canBorrow} size='large' fullWidth variant="contained" className={classes.button} color="primary" onClick={this.borrow.bind(this)}>
                            Borrow
                        </Button> : <Button disabled={zbtcAllowanceRequesting}
                            size='large'
                            variant="contained"
                            className={classes.button}
                            color="primary"
                            onClick={this.allowZbtc.bind(this)}>
                            {zbtcAllowanceRequesting ? 'Requesting...' : 'Allow zBTC contract'}
                        </Button>}
                      </Grid>
                </Grid>}
                {selectedTab === 1 && <Grid className={classes.section} container>
                  <Grid item xs={12}>
                      <TextField
                          className={classes.inputField}
                          variant="outlined"
                          placeholder='DAI Amount'
                          onChange={(event) => {
                              store.set('repayAmount', event.target.value)
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
                          placeholder='BTC Address'
                          onChange={(event) => {
                              store.set('repayAddress', event.target.value)
                          }}
                          inputProps={{ 'aria-label': 'bare' }}/>
                  </Grid>
                  <Grid item xs={12}>
                    <Button disabled={!canRepay} size='large' variant="contained" className={classes.button} color="primary" onClick={this.repay.bind(this)}>
                        Repay
                    </Button>
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
