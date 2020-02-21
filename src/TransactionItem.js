import React from 'react';
import { withStyles, ThemeProvider } from '@material-ui/styles';
import { createMuiTheme } from '@material-ui/core/styles';
import classNames from 'classnames'
import blueGrey from '@material-ui/core/colors/blueGrey';
import grey from '@material-ui/core/colors/grey';

import { initDeposit, initWithdraw } from './txUtils'

import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import Divider from '@material-ui/core/Divider';
import Paper from '@material-ui/core/Paper'
import Grid from '@material-ui/core/Grid'
import Typography from '@material-ui/core/Typography'
import LinearProgress from '@material-ui/core/LinearProgress';
import ClearIcon from '@material-ui/icons/Clear';
import CircularProgress from '@material-ui/core/CircularProgress';

import RenSDK from "@renproject/ren";
import theme from './theme'



const styles = () => ({
    paper: {
      padding: theme.spacing(2),
      // border: '1px solid #EBEBEB',
      // borderRadius: theme.shape.borderRadius,
      // textAlign: 'center',
      // color: theme.palette.text.secondary,
    },
    pendingItem: {
      marginBottom: theme.spacing(2),
      position: 'relative',
      minHeight: 96
    },
    pendingTitle: {
        margin: 0,
        textAlign: 'center'
    },
    pendingSubTitle: {
        // marginBottom: theme.spacing(1),
        fontSize: 14,
        textAlign: 'center'
    },
    progress: {
        marginTop: theme.spacing(1),
    },
    pendingMsg: {
        // float: 'right'
    },
    amountContainer: {
        textAlign: 'right'
    },
    txLink: {
        // float: 'right'
    },
    clearContainer: {
        height: '100%'
    },
    clearButton: {
        // position: 'absolute',
        // top: theme.spacing(1),
        // right: theme.spacing(1)
    },
    spinner: {
        position: 'relative',
        margin: '0px auto',
        width: 24,
        marginBottom: theme.spacing(2)
    },
    spinnerTop: {
        color: '#eee',
    },
    spinnerBottom: {
        color: theme.palette.primary.main,
        animationDuration: '550ms',
        position: 'absolute',
        left: 0,
    },
    cancelLink: {
      textAlign: 'center',
      marginTop: theme.spacing(2)
    }
})

class TransactionItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
        }
    }

    async componentDidMount() {
        const { type, awaiting, params, gatewayAddress, amount } = this.props
    }

    render() {
        // console.log(this.props)
        const { type, source, awaiting, amount, id, destAddress, renBtcAddress, network, store, error, tx } = this.props
        const classes = this.props.classes
        const walletAddress = store.get('walletAddress')

        // let title = `Pending ${source} ${type}`
        let title = ''
        let msg = ''
        let txLink = ''
        let completed = 0

        const btcAddress = renBtcAddress || destAddress
        const linkPath = btcAddress && btcAddress.charAt(0) === '2' ? 'btctest' : 'btc'
        const isDepositFirstStep = awaiting === 'btc-init' && type === 'deposit'
        const isWithdrawFirstStep = awaiting === 'eth-init' && type === 'withdraw' && !error
        const isSubmittingToRen = awaiting === 'ren-init' || awaiting === 'ren-settle'
        const isSubmittingToEth = (awaiting === 'eth-settle' && error === false) || isWithdrawFirstStep

        if (type === 'deposit') {
            if (awaiting === 'btc-init') {
                // msg = 'Awaiting BTC transaction...'
                // msg = 'Send exactly ' + amount + ' BTC to ' + renBtcAddress
                title = `Deposit ${amount} BTC to`
                msg = renBtcAddress
                completed = 0
            } else if (awaiting === 'btc-settle') {
                title = `Waiting for confirmations (${tx.btcConfirmations}/2)`
            } else if (awaiting === 'ren-settle') {
                title = `Submitting to RenVM. This may take a few minutes...`
                msg = ''
                completed = 33
            } else if (awaiting === 'eth-init') {
                title = `Opening CDP`
                msg = error ? <span><a href='javascript:;' className={classes.txLink} onClick={()=>{
                    initDeposit.bind(this)(tx)
                }}>Retry</a></span> : 'Completing deposit on Ethereum...'
                completed = 66
            } else if (awaiting === 'eth-settle') {
                title = `Opening CDP`
                msg = error ? <span><a href='javascript:;' className={classes.txLink} onClick={()=>{
                    initDeposit.bind(this)(tx)
                }}>Retry</a></span> : 'Depositing BTC and minting DAI...'
                completed = 66
            } else if (awaiting === '') {
                title = <span>Collateralization successful</span>
                msg = <span>
                  <a className={classes.txLink} target='_blank' href={'https://www.blockchain.com/' + linkPath + '/address/' + renBtcAddress}>View BTC Transaction</a>
                  <br />
                  <a className={classes.txLink} target='_blank' href={'https://kovan.etherscan.io/address/' + walletAddress}>View Ethereum Transaction</a>
                </span>
                completed = 100
                // txLink = 'https://www.blockchain.com/' + linkPath + '/address/' + renBtcAddress
            }
        } else if (type === 'withdraw') {
        }

        return <div className={classes.pendingItem}><div key={id} className={classes.paper}>
            <Grid container>
                <Grid item xs={12}>
                    <Grid container>
                      {tx.awaiting && <div className={classes.spinner}>
                            <CircularProgress
                              variant="determinate"
                              value={100}
                              className={classes.spinnerTop}
                              size={24}
                              thickness={4}
                            />
                            <CircularProgress
                              variant="indeterminate"
                              disableShrink
                              className={classes.spinnerBottom}
                              size={24}
                              thickness={4}
                            />
                      </div>}
                        <Grid item xs={12}>
                            <Grid container alignItems='center'>
                                <Grid item xs={12}>
                                    {<Typography variant='subtitle1' className={classes.pendingTitle}>
                                        {title}
                                    </Typography>}
                                </Grid>
                            </Grid>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant='subtitle2' className={classes.pendingSubTitle}>
                                <span className={classes.pendingMsg}>{msg}</span>
                                {/*txLink && <a className={classes.txLink} target='_blank' href={txLink}>View Transaction</a>*/}
                            </Typography>
                        </Grid>
                    </Grid>
                    {tx.btcTxHash && tx.awaiting === 'btc-settle' && <Grid item xs={12} className={classes.cancelLink}>
                        <a target='_blank' href={`https://live.blockcypher.com/btc-testnet/tx/${tx.btcTxHash}`}
                            className={classes.cancelLink}>
                            View pending transaction
                        </a>
                    </Grid>}
                    {!tx.awaiting && <Grid item xs={12} className={classes.cancelLink}>
                        <a className={classes.cancelLink} href='javascript:;' onClick={this.props.onTxClear}>Back</a>
                    </Grid>}
                    {(!isSubmittingToRen && !isSubmittingToEth && !tx.btcTxHash) && <Grid item xs={12} className={classes.cancelLink}>
                        <a href='javascript:;' onClick={this.props.onTxClear}>Cancel</a>
                    </Grid>}
                </Grid>
            </Grid>
        </div></div>
    }
}

export default withStyles(styles)(TransactionItem);
