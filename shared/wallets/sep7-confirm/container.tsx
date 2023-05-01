import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import SEP7Confirm from '.'

export default () => {
  const _inputURI = Container.useSelector(state => state.wallets.sep7ConfirmURI)
  const builtPaymentAdvancedWaitingKey = Constants.calculateBuildingAdvancedWaitingKey
  const loading = Container.useSelector(state => !state.wallets.sep7ConfirmInfo)
  const sep7ConfirmFromQR = Container.useSelector(state => state.wallets.sep7ConfirmFromQR)
  const sep7ConfirmInfo = Container.useSelector(state => state.wallets.sep7ConfirmInfo)
  const sep7ConfirmPath = Container.useSelector(state => state.wallets.sep7ConfirmPath)
  const sep7SendError = Container.useSelector(state => state.wallets.sep7SendError)
  const sep7WaitingKey = Constants.sep7WaitingKey

  const dispatch = Container.useDispatch()
  const _onAcceptPath = (inputURI: string) => {
    dispatch(WalletsGen.createAcceptSEP7Path({inputURI}))
  }
  const _onAcceptPay = (inputURI: string, amount: string) => {
    dispatch(WalletsGen.createAcceptSEP7Pay({amount, inputURI}))
  }
  const _onAcceptTx = (inputURI: string) => {
    dispatch(WalletsGen.createAcceptSEP7Tx({inputURI}))
  }
  const onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onLookupPath = () => {
    dispatch(WalletsGen.createCalculateBuildingAdvanced({forSEP7: true}))
  }

  const props = (() => {
    if (loading || !sep7ConfirmInfo) {
      return {
        amount: null,
        assetCode: '',
        availableToSendNative: '',
        builtPaymentAdvancedWaitingKey: builtPaymentAdvancedWaitingKey,
        callbackURL: null,
        displayAmountFiat: '',
        findPathError: sep7ConfirmPath.findPathError,
        fromQRCode: false,
        loading: true,
        memo: null,
        memoType: null,
        message: null,
        onAcceptPath: () => null,
        onAcceptPay: () => null,
        onAcceptTx: () => null,
        onBack: onClose,
        onLookupPath: () => null,
        operation: 'pay' as const,
        originDomain: '',
        path: sep7ConfirmPath,
        recipient: null,
        sendError: sep7SendError,
        sep7WaitingKey: sep7WaitingKey,
        signed: null,
        summary: {
          fee: 0,
          memo: '',
          memoType: '',
          operations: new Array<string>(),
          source: '',
        },
      }
    }
    const {
      amount,
      assetCode,
      availableToSendNative,
      callbackURL,
      displayAmountFiat,
      memo,
      memoType,
      message,
      originDomain,
      recipient,
      signed,
      summary,
    } = sep7ConfirmInfo
    const sendError = sep7SendError
    const path = sep7ConfirmPath
    const {findPathError} = path
    const rawOp = sep7ConfirmInfo.operation
    const fromQRCode = sep7ConfirmFromQR
    const operation = rawOp === 'pay' ? ('pay' as const) : rawOp === 'tx' ? ('tx' as const) : ('' as const)

    if (operation === '') {
      throw new Error('invalid operation' + sep7ConfirmInfo.operation)
    }

    return {
      amount,
      assetCode,
      availableToSendNative,
      builtPaymentAdvancedWaitingKey: builtPaymentAdvancedWaitingKey,
      callbackURL,
      displayAmountFiat,
      findPathError,
      fromQRCode,
      loading: loading,
      memo,
      memoType,
      message,
      onAcceptPath: () => _onAcceptPath(_inputURI),
      onAcceptPay: (amount: string) => _onAcceptPay(_inputURI, amount),
      onAcceptTx: () => _onAcceptTx(_inputURI),
      onBack: onClose,
      onLookupPath: onLookupPath,
      operation,
      originDomain,
      path,
      recipient,
      sendError,
      sep7WaitingKey: sep7WaitingKey,
      signed,
      summary,
    }
  })()
  return <SEP7Confirm {...props} />
}
