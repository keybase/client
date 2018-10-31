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
    (built.banners || []).map(banner => ({
      bannerBackground: Constants.bannerLevelToBackground(banner.level),
      bannerText: banner.message,
      hideOnConfirm: banner.hideOnConfirm,
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
  onBack: () => (navigateUp ? dispatch(navigateUp()) : onBack && onBack()),
  onClose: () => (navigateUp ? dispatch(navigateUp()) : onBack && onBack()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ConfirmSend)
