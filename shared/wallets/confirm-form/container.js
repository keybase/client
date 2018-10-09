// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment
  const currency = state.wallets.currencies.find(c => c.code === build.currency)
  const banners = (state.wallets.sentPaymentError
    ? [
        {
          bannerBackground: 'HighRisk',
          bannerText: state.wallets.sentPaymentError,
        },
      ]
    : []
  ).concat(
    (built.banners || []).map(banner => ({
      bannerBackground: Constants.bannerLevelToBackground(banner.level),
      bannerText: banner.message,
    }))
  )
  return {
    amount: built.amountFormatted || build.amount + ' ' + build.currency,
    assetConversion: built.worthDescription,
    assetType: build.currency,
    symbol: currency ? currency.symbol : null,
    banners,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    sendFailed: !!state.wallets.sentPaymentError,
    waitingKey: Constants.sendPaymentWaitingKey,
    yourUsername: state.config.username,
    worthDescription: built.worthDescription,
    amountFormatted: build.amountFormatted,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onClose: () => dispatch(navigateUp()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ConfirmSend)
