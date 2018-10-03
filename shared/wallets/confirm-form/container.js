// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment
  let banners = state.wallets.sentPaymentError
    ? [
        {
          bannerBackground: 'HighRisk',
          bannerText: state.wallets.sentPaymentError,
        },
      ]
    : []
  banners = banners.concat(
    (built.banners || []).map(banner => ({
      bannerBackground: Constants.bannerLevelToBackground(banner.level),
      bannerText: banner.message,
    }))
  )
  return {
    amount: build.amount,
    assetConversion: built.worthDescription,
    assetType: build.currency,
    banners,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    sendFailed: !!state.wallets.sentPaymentError,
    waitingKey: Constants.sendPaymentWaitingKey,
    yourUsername: state.config.username,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(navigateUp())
  },
  onClose: () => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(navigateUp())
  },
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(ConfirmSend)
