// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect} from '../../util/container'
import type {NavigateUpPayload} from '../../actions/route-tree-gen'

type OwnProps = {
  navigateUp?: () => NavigateUpPayload, // if routed
  onBack?: () => void, // if direct
}

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
    (built.banners || []).filter(banner => !banner.hideOnConfirm).map(banner => ({
      bannerBackground: Constants.bannerLevelToBackground(banner.level),
      bannerText: banner.message,
    }))
  )
  return {
    banners,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    sendFailed: !!state.wallets.sentPaymentError,
    waitingKey: Constants.sendPaymentWaitingKey,
    sendingIntentionXLM: built.sendingIntentionXLM,
    displayAmountXLM: built.displayAmountXLM,
    displayAmountFiat: built.displayAmountFiat,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, onBack}: OwnProps) => ({
  _onBack: () => (navigateUp ? dispatch(navigateUp()) : onBack && onBack()),
  _onClose: () => (navigateUp ? dispatch(navigateUp()) : onBack && onBack()),
  _onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => {
    // Clear sentPaymentError when navigating away.
    return {
      ...o,
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
