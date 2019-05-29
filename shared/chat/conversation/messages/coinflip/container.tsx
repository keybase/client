import CoinFlip from '.'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import {namedConnect} from '../../../../util/container'
import HiddenString from '../../../../util/hidden-string'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isSendError: boolean
  flipGameID: string
  text: HiddenString
}

const noParticipants = []

const mapStateToProps = (state, {flipGameID, isSendError}: OwnProps) => {
  const status = state.chat2.getIn(['flipStatusMap', flipGameID])
  return !status
    ? {
        commitmentVis: '',
        isSendError,
        participants: noParticipants,
        progressText: '',
        resultText: '',
        revealVis: '',
        showParticipants: false,
      }
    : {
        commitmentVis: status.commitmentVisualization,
        errorInfo: status.phase === RPCChatTypes.UICoinFlipPhase.error ? status.errorInfo : null,
        isSendError,
        participants: status.participants || [],
        phase: Constants.flipPhaseToString(status.phase),
        progressText: status.progressText,
        resultInfo: status.resultInfo,
        resultText: status.resultText,
        revealVis: status.revealVisualization,
        showParticipants: Constants.flipPhaseToString(status.phase) === 'complete',
      }
}

const mapDispatchToProps = (dispatch, {conversationIDKey, text}: OwnProps) => ({
  onFlipAgain: () => dispatch(Chat2Gen.createMessageSend({conversationIDKey, text})),
})

export default namedConnect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...s, ...d}), 'CoinFlip')(
  CoinFlip
)
