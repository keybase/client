// @flow
import CoinFlip from '.'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../../../util/container'

type OwnProps = {|flipGameID: string|}

const participantStatuses = [
  RPCChatTypes.chatUiUICoinFlipPhase.commitment,
  RPCChatTypes.chatUiUICoinFlipPhase.reveals,
  RPCChatTypes.chatUiUICoinFlipPhase.complete,
]

const mapStateToProps = (state, {flipGameID}: OwnProps) => {
  const status = state.chat2.getIn(['flipStatusMap', flipGameID])
  return !status
    ? {
        isError: false,
        participants: [],
        progressText: 'Waiting for flip information...',
        resultText: '',
        showParticipants: false,
      }
    : {
        isError: status.phase === RPCChatTypes.chatUiUICoinFlipPhase.error,
        participants: status.participants || [],
        progressText: status.progressText,
        resultText: status.resultText,
        showParticipants: participantStatuses.indexOf(status.phase) >= 0,
      }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  (d, o) => ({}),
  (s, d, o) => ({...s}),
  'CoinFlip'
)(CoinFlip)
