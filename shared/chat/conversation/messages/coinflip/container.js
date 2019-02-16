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
  return {
    isError: status ? status.phase === RPCChatTypes.chatUiUICoinFlipPhase.error : false,
    progressText: status ? status.progressText : 'Waiting for flip to start...',
    resultText: status ? status.resultText : '',
    showParticipants: status ? participantStatuses.indexOf(status.phase) >= 0 : false,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  (d, o) => ({}),
  (s, d, o) => ({...s}),
  'CoinFlip'
)(CoinFlip)
