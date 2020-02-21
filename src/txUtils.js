import RenSDK from "@renproject/ren";
import BigNumber from "bignumber.js";
import Web3 from "web3";

import PROXY_ABI from './abi.json'

export const PROXY_ADDRESS = '0x89f68f6d66635ee901325d21a06acf6d60f3c6a3'
export const DIRECT_PROXY_ADDRESS = '0x483bFCFA16500a84035BcE00abF2812568e1A323'
export const ZBTC_ADDRESS = '0xc6069e8dea210c937a846db2cebc0f58ca111f26'
export const DAI_ADDRESS = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'


export const addTx = (store, tx) => {
    const storeString = 'transactions'
    let txs = store.get(storeString)
    txs.push(tx)
    store.set(storeString, txs)
    localStorage.setItem(storeString, JSON.stringify(txs))
    // for debugging
    window[storeString] = txs
}

export const updateTx = (store, newTx) => {
    const storeString = 'transactions'
    const txs = store.get(storeString).map(t => {
        if (t.id === newTx.id) {
            // const newTx = Object.assign(t, props)
            return newTx
        }
        return t
    })
    store.set(storeString, txs)
    localStorage.setItem(storeString, JSON.stringify(txs))

    // for debugging
    window[storeString] = txs
}

export const removeTx = (store, tx) => {
    const storeString = 'transactions'
    let txs = store.get(storeString).filter(t => (t.id !== tx.id))
    // console.log(txs)
    store.set(storeString, txs)
    localStorage.setItem(storeString, JSON.stringify(txs))

    // for debugging
    window[storeString] = txs
}

export const repay = async function() {
    const { store } = this.props
    const { repayAmount, accounts, web3 } = this.props.store.getState()
    const contract = new web3.eth.Contract(PROXY_ABI, PROXY_ADDRESS)
    const result = await contract.methods.burnDai(accounts[0], repayAmount)
}

export const completeDeposit = async function(tx) {
    const { store }  = this.props
    const web3 = store.get('web3')
    const walletAddress = store.get('walletAddress')

    const { params, awaiting, renResponse, renSignature } = tx

    console.log('completeDeposit', tx)

    const adapterContract = new web3.eth.Contract(PROXY_ABI, PROXY_ADDRESS)

    updateTx(store, Object.assign(tx, { awaiting: 'eth-settle' }))

    try {
        const result = await adapterContract.methods.mintDai(
            params.contractCalls[0].contractParams[0].value,
            params.contractCalls[0].contractParams[1].value,
            params.contractCalls[0].contractParams[2].value,
            params.sendAmount,
            renResponse.autogen.nhash,
            renSignature
        ).send({
            from: walletAddress
        })
        console.log('result', result)
        updateTx(store, Object.assign(tx, { awaiting: '' }))
    } catch(e) {
        console.log(e)
        updateTx(store, Object.assign(tx, { error: true }))
    }
}

export const initShiftIn = function(tx) {
    const { amount, renBtcAddress, params, ethSig } = tx
    const {
        sdk,
        web3,
        walletAddress,
        borrowAmount,
        borrowBtcAddress
    } = this.props.store.getState()

    console.log('initShiftIn', tx)

    const borrowDaiAmount = Number((amount * 10000) * 0.66).toFixed(2)

    const data = {
        // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
        sendToken: RenSDK.Tokens.BTC.Btc2Eth,

        // Amount of BTC we are sending (in Satoshis)
        sendAmount: Math.floor(amount * (10 ** 8)), // Convert to Satoshis

        // The contract we want to interact with
        sendTo: PROXY_ADDRESS,

        // The name of the function we want to call
        contractFn: "mintDai",

        // Arguments expected for calling `deposit`
        contractParams: [
            {
                name: "_to",
                type: "address",
                value: params ? params.contractCalls[0].contractParams[0].value : walletAddress,
            },
            {
                name: "_dart",
                type: "int",
                value: params ? params.contractCalls[0].contractParams[1].value : web3.utils.toWei(borrowDaiAmount),
            },
            {
                name: "_btcAddr",
                type: "bytes",
                value: params ? params.contractCalls[0].contractParams[2].value : web3.utils.fromAscii(borrowBtcAddress),
            },
        ],

        nonce: params && params.nonce ? params.nonce : RenSDK.utils.randomNonce()
    }

    // if (renBtcAddress) {
    //     shiftIn
    // }

    const shiftIn = sdk.shiftIn(data)

    return shiftIn
}

export const initShiftOut = async function(tx) {
}

export const initDeposit = async function(tx) {
    const { store }  = this.props
    const web3 = store.get('web3')
    const { params, awaiting, renResponse, renSignature, error } = tx

    console.log('initDeposit', tx)

    // completed
    if (!awaiting) return

    // clear error when re-attempting
    if (error) {
        updateTx(store, Object.assign(tx, { error: false }))
    }

    // ren already exposed a signature
    if (renResponse && renSignature) {
        completeDeposit.bind(this)(tx)
    } else {
        // create or re-create shift in
        const shiftIn = await initShiftIn.bind(this)(tx)

        console.log('shiftIn', shiftIn)

        if (!params) {
            addTx(store, Object.assign(tx, {
                params: shiftIn.params,
                renBtcAddress: shiftIn.addr()
            }))
        }

        // wait for btc
        const deposit = await shiftIn
            .waitForDeposit(2)
            .on("deposit", dep => {
                console.log('on deposit', dep)
                if (dep.utxo) {
                    if (awaiting === 'btc-init') {
                        updateTx(store, Object.assign(tx, {
                            awaiting: 'btc-settle',
                            btcConfirmations: dep.utxo.confirmations,
                            btcTxHash: dep.utxo.txid
                        }))
                    } else {
                        updateTx(store, Object.assign(tx, {
                            btcConfirmations: dep.utxo.confirmations,
                            btcTxHash: dep.utxo.txid
                        }))
                    }
                }
            })

        console.log('shiftIn after', shiftIn)

        updateTx(store, Object.assign(tx, { awaiting: 'ren-settle' }))

        try {
            const signature = await deposit.submitToRenVM();
            updateTx(store, Object.assign(tx, {
                renResponse: signature.response,
                renSignature: signature.signature
            }))

            // console.log('initDeposit sig', signature)
            // removeWindowBlocker()

            completeDeposit.bind(this)(tx)
        } catch(e) {
          console.log(e)
            // removeWindowBlocker()
        }
    }
}

export const initWithdraw = async function(tx) {
}

export const initMonitoring = function() {
    const transactions = this.props.store.get('transactions')
    const pending = transactions.filter(t => (t.awaiting))
    pending.map(p => {
        if (p.type === 'deposit') {
            initDeposit.bind(this)(p)
        } else if (p.type === 'withdraw') {
            initWithdraw.bind(this)(p)
        }
    })
}

export default {
    addTx,
    updateTx,
    removeTx,
    initShiftIn,
    initShiftOut,
    initDeposit,
    initMonitoring
}
