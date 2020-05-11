import RenSDK from "@renproject/ren";
import BigNumber from "bignumber.js";
import Web3 from "web3";

import PROXY_ABI from './proxyABI.json'
import ERC_ABI from './daiABI.json'

// export const PROXY_ADDRESS = '0xf026B91Eb32fE6e2F3FcFb3081715723E1983e48'
// export const DIRECT_PROXY_ADDRESS = '0xCb56D0859fD0aE5D9e7F13636b4Bb78936ddA2f8'
// export const ZBTC_ADDRESS = '0xc6069E8DeA210C937A846db2CEbC0f58ca111f26'
export const PROXY_ADDRESS = '0x40f41fd6f5fb0dd1bf7e05e3a07a2ac56ac6fe11'
export const DIRECT_PROXY_ADDRESS = '0x9eb0580318ea2ef2889377fabe1b48fc95d43217'
export const WBTC_ADDRESS = '0x7419f744bBF35956020C1687fF68911cD777f865'
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

export const updateWalletData = async function() {
    const store = this.props.store

    const web3 = store.get('web3')
    const walletAddress = store.get('walletAddress')

    if (!web3 || !walletAddress) {
        return
    }

    const contract = new web3.eth.Contract(ERC_ABI, DAI_ADDRESS);

    const balance = await contract.methods.balanceOf(walletAddress).call();
    store.set('balance', Number(web3.utils.fromWei(balance)).toFixed(6))

    const daiAllowance = await getDAIAllowance.bind(this)()
    store.set('daiAllowance', daiAllowance)
}

export const getDAIAllowance = async function() {
    const { walletAddress, web3 } = this.props.store.getState()
    const contract = new web3.eth.Contract(ERC_ABI, DAI_ADDRESS)
    try {
        return await contract.methods.allowance(walletAddress, PROXY_ADDRESS).call()
    } catch(e) {
        console.log(e)
        return ''
    }
}

export const setDAIAllowance = async function() {
    const store = this.props.store
    const { walletAddress, web3 } = store.getState()
    const contract = new web3.eth.Contract(ERC_ABI, DAI_ADDRESS)
    store.set('daiAllowanceRequesting', true)
    try {
        return await contract.methods.approve(PROXY_ADDRESS, web3.utils.toWei('1000000')).send({
            from: walletAddress
        })
        await updateWalletData.bind(this)();
        store.set('daiAllowanceRequesting', false)
    } catch(e) {
        console.log(e)
        store.set('daiAllowanceRequesting', false)
    }
}

export const burnDai = async function() {
    const { store } = this.props
    const { repayAmount, repayBtcAmount, walletAddress, web3 } = this.props.store.getState()
    console.log('burnDai', repayAmount, repayBtcAmount)
    const contract = new web3.eth.Contract(PROXY_ABI, PROXY_ADDRESS)
    const result = await contract.methods.burnDai(
        String(Math.round(Number(repayBtcAmount) * (10 ** 8))),
        web3.utils.toWei(repayAmount),
        web3.utils.toWei('0')
        // '14000',
        // '1000000000000000000'
    ).send({
        from: walletAddress
    })
    console.log('burnDai result', result)
}

export const completeDeposit = async function(tx) {
    const { store }  = this.props
    const web3 = store.get('web3')
    const walletAddress = store.get('walletAddress')

    const { params, awaiting, renResponse, renSignature } = tx

    console.log('completeDeposit', tx)

    const adapterContract = new web3.eth.Contract(PROXY_ABI, PROXY_ADDRESS)

    updateTx(store, Object.assign(tx, { awaiting: 'eth-settle' }))

    const utxoAmount = renResponse.autogen.amount

    try {
        const result = await adapterContract.methods.mintDai(
            params.contractCalls[0].contractParams[1].value,
            params.contractCalls[0].contractParams[2].value,
            params.contractCalls[0].contractParams[3].value,
            utxoAmount,
            renResponse.autogen.nhash,
            renSignature
        ).send({
            from: walletAddress
        })
        console.log('result', result)
        updateTx(store, Object.assign(tx, { awaiting: '' }))
        updateWalletData.bind(this)()
    } catch(e) {
        console.log(e)
        updateTx(store, Object.assign(tx, { error: true }))
    }
}

export const initShiftIn = function(tx) {
    const {
        amount,
        daiAmount,
        btcAddress,
        params,
    } = tx
    const {
        sdk,
        web3,
        walletAddress,
    } = this.props.store.getState()

    console.log('initShiftIn', tx)

    const data = {
        sendToken: RenSDK.Tokens.BTC.Btc2Eth,
        sendAmount: Math.floor(amount * (10 ** 8)), // Convert to Satoshis
        sendTo: PROXY_ADDRESS,
        contractFn: "mintDai",
        contractParams: params ? params.contractCalls[0].contractParams : [
            {
                name: "_sender",
                type: "address",
                value: walletAddress,
            },
            {
                name: "_dart",
                type: "uint256",
                value: web3.utils.toWei(daiAmount),
            },
            {
                name: "_btcAddr",
                type: "bytes",
                value: web3.utils.fromAscii(btcAddress),
            },
            {
                name: "_minWbtcAmount",
                type: "uint256",
                value: web3.utils.toWei('0'),
            },
        ],
        nonce: params && params.nonce ? params.nonce : RenSDK.utils.randomNonce()
    }

    const shiftIn = sdk.lockAndMint(data)

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
                renBtcAddress: await shiftIn.gatewayAddress()
            }))
        }

        // wait for btc
        const deposit = await shiftIn
            .wait(2)
            .on("deposit", dep => {
                console.log('on deposit', dep)
                if (dep.utxo) {
                    if (awaiting === 'btc-init') {
                        updateTx(store, Object.assign(tx, {
                            awaiting: 'btc-settle',
                            btcConfirmations: dep.utxo.confirmations,
                            btcTxHash: dep.utxo.txHash,
                            btcTxVOut: dep.utxo.vOut
                        }))
                    } else {
                        updateTx(store, Object.assign(tx, {
                            btcConfirmations: dep.utxo.confirmations,
                            btcTxHash: dep.utxo.txHash,
                            btcTxVOut: dep.utxo.vOut
                        }))
                    }
                }
            })

        console.log('shiftIn after', shiftIn)

        updateTx(store, Object.assign(tx, { awaiting: 'ren-settle' }))

        try {
            const signature = await deposit.submit();
            updateTx(store, Object.assign(tx, {
                renResponse: signature.renVMResponse,
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
