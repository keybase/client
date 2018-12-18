// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as ProfileGen from '../../actions/profile-gen'
import * as TrackerGen from '../../actions/tracker-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, isMobile, type RouteProps} from '../../util/container'

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
    (built.reviewBanners || []).map(banner => ({
      bannerBackground: Constants.bannerLevelToBackground(banner.level),
      bannerText: banner.message,
      reviewProofs: banner.proofsChanged,
    }))
  )
  return {
    banners,
    displayAmountFiat: built.displayAmountFiat,
    displayAmountXLM: built.displayAmountXLM,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    readyToSend: built.readyToSend,
    sendFailed: !!state.wallets.sentPaymentError,
    sendingIntentionXLM: built.sendingIntentionXLM,
    to: build.to,
    waitingKey: Constants.sendPaymentWaitingKey,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}: OwnProps) => ({
  _onBack: () => dispatch(navigateUp()),
  _onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
  _onClose: () => dispatch(navigateUp()),
  _onReviewProofs: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
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
      onReviewProofs: () => d._onReviewProofs(s.to),
      onSendClick: d.onSendClick,
    }
  }
)(ConfirmSend)
