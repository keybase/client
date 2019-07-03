import CoinFlip, {Props} from '.'
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

const noParticipants: Array<RPCChatTypes.UICoinFlipParticipant> = []
type PhaseType = Props['phase']

export default namedConnect(
  (state, {flipGameID, isSendError}: OwnProps) => {
    const status = state.chat2.flipStatusMap.get(flipGameID)
    return !status
      ? {
          commitmentVis: '',
          errorInfo: null,
          isSendError,
          participants: noParticipants,
          phase: null,
          progressText: '',
          resultText: '',
          revealVis: '',
          showParticipants: false,
        }
      : {
          commitmentVis: status.commitmentVisualization,
          errorInfo: status.phase === RPCChatTypes.UICoinFlipPhase.error ? status.errorInfo : null,
          isSendError,
          participants: status.participants || noParticipants,
          phase: Constants.flipPhaseToString(status.phase) as PhaseType,
          progressText: status.progressText,
          resultInfo: status.resultInfo,
          resultText: status.resultText,
          revealVis: status.revealVisualization,
          showParticipants: Constants.flipPhaseToString(status.phase) === 'complete',
        }
  },
  (dispatch, {conversationIDKey, text}: OwnProps) => ({
    onFlipAgain: () => dispatch(Chat2Gen.createMessageSend({conversationIDKey, text})),
  }),
  (s, d, _: OwnProps) => ({...s, ...d}),
  'CoinFlip'
)(CoinFlip)
