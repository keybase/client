// @flow
import CoinFlip from '.'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../../../util/container'

type OwnProps = {|gameID: string|}

const participantStatuses = [
  RPCChatTypes.chatUiUICoinFlipPhase.commitment,
  RPCChatTypes.chatUiUICoinFlipPhase.reveals,
  RPCChatTypes.chatUiUICoinFlipPhase.complete,
]

const mapStateToProps = (state, {gameID}: OwnProps) => {
  const status = state.chat2.getIn(['flipStatusMap', gameID])
  return !status
    ? {
        isError: false,
        participants: [],
        progressText: 'Waiting for flip to start...',
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
