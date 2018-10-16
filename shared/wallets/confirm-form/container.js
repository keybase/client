// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect} from '../../util/container'

const mapStateToProps = state => {
  const build = state.wallets.building
  const built = state.wallets.builtPayment
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
    banners,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    sendFailed: !!state.wallets.sentPaymentError,
    waitingKey: Constants.sendPaymentWaitingKey,
    worthDescription: built.worthDescription,
  }
}

const mapDispatchToProps = (dispatch, {onBack}) => ({
  onBack,
  onClose: onBack,
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ConfirmSend)
