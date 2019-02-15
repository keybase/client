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
    displayText: status ? status.displayText : 'unknown flip',
    isResult: status ? status.phase === RPCChatTypes.chatUiUICoinFlipPhase.complete : false,
    showParticipants: status ? participantStatuses.indexOf(status.phase) >= 0 : false,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  (d, o) => ({}),
  (s, d, o) => ({...s}),
  'CoinFlip'
)(CoinFlip)
