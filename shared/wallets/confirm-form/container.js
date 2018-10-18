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
  const assetType = build.currency || 'XLM'
  return {
    amount: built.amountFormatted || build.amount + ' ' + assetType,
    assetConversion: built.worthDescription,
    assetType: assetType,
    banners,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    sendFailed: !!state.wallets.sentPaymentError,
    waitingKey: Constants.sendPaymentWaitingKey,
    yourUsername: state.config.username,
    worthDescription: built.worthDescription,
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
