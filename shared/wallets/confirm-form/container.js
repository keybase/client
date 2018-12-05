// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{}, {}>

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
    (built.banners || [])
      .filter(banner => !banner.hideOnConfirm)
      .map(banner => ({
        bannerBackground: Constants.bannerLevelToBackground(banner.level),
        bannerText: banner.message,
      }))
  )
  return {
    banners,
    displayAmountFiat: built.displayAmountFiat,
    displayAmountXLM: built.displayAmountXLM,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    sendFailed: !!state.wallets.sentPaymentError,
    sendingIntentionXLM: built.sendingIntentionXLM,
    waitingKey: Constants.sendPaymentWaitingKey,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}: OwnProps) => ({
  _onBack: () => dispatch(navigateUp()),
  _onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
  _onClose: () => dispatch(navigateUp()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => {
    // Clear sentPaymentError when navigating away.
    return {
      ...s,
      onBack: () => {
        d._onClearErrors()
        d._onBack()
      },
      onClose: () => {
        d._onClearErrors()
        d._onClose()
      },
      onSendClick: d.onSendClick,
    }
  }
)(ConfirmSend)
