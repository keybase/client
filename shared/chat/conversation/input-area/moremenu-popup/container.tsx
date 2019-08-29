import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as WalletsGen from '../../../../actions/wallets-gen'
import {connect, TypedState, TypedDispatch} from '../../../../util/container'
import HiddenString from '../../../../util/hidden-string'
import MoreMenuPopup from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  onHidden: () => void
  visible: boolean
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _meta: Constants.getMeta(state, ownProps.conversationIDKey),
  _wallet: Constants.shouldShowWalletsIcon(state, ownProps.conversationIDKey),
  _you: state.config.username,
})

const mapDispatchToProps = (dispatch: TypedDispatch, ownProps: OwnProps) => ({
  _onLumens: (to: string, isRequest: boolean) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({
        isRequest,
        recipientType: 'keybaseUser',
        to,
      })
    )
  },
  _onSlashPrefill: (text: string) => {
    dispatch(
      Chat2Gen.createSetUnsentText({
        conversationIDKey: ownProps.conversationIDKey,
        text: new HiddenString(text),
      })
    )
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => {
    let to = ''
    if (stateProps._wallet) {
      const otherParticipants = stateProps._meta.participants.filter(u => u !== stateProps._you)
      to = otherParticipants.first()
    }
    return {
      conversationIDKey: ownProps.conversationIDKey,
      onCoinFlip: () => dispatchProps._onSlashPrefill('/flip '),
      onGiphy: () => dispatchProps._onSlashPrefill('/giphy '),
      onHidden: ownProps.onHidden,
      onInsertSlashCommand: () => dispatchProps._onSlashPrefill('/'),
      onRequestLumens: stateProps._wallet ? () => dispatchProps._onLumens(to, true) : undefined,
      onSendLumens: stateProps._wallet ? () => dispatchProps._onLumens(to, false) : undefined,
      visible: ownProps.visible,
    }
  }
)(MoreMenuPopup)
