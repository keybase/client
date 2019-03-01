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

const noParticipants = []

const mapStateToProps = (state, {flipGameID}: OwnProps) => {
  const status = state.chat2.getIn(['flipStatusMap', flipGameID])
  return !status
    ? {
        commitmentVis: '',
        participants: noParticipants,
        progressText: '',
        resultText: '',
        revealVis: '',
        showParticipants: false,
      }
    : {
        commitmentVis: status.commitmentVisualization,
        errorInfo: status.phase === RPCChatTypes.chatUiUICoinFlipPhase.error ? status.errorInfo : null,
        // hasCommitments: status.phase > RPCChatTypes.chatUiUICoinFlipPhase.commitment,
        // hasSecrets: status.phase > RPCChatTypes.chatUiUICoinFlipPhase.reveals,
        // isComplete: status.phase >= RPCChatTypes.chatUiUICoinFlipPhase.complete,
        hasCommitments: participantStatuses.includes(status.phase),
        hasSecrets: participantStatuses.includes(status.phase),
        isComplete: participantStatuses.includes(status.phase),
        isError: status.phase === RPCChatTypes.chatUiUICoinFlipPhase.error,
        participants: status.participants || [],
        progressText: status.progressText,
        resultInfo: status.resultInfo,
        resultText: status.resultText,
        revealVis: status.revealVisualization,
        showParticipants: participantStatuses.indexOf(status.phase) === 2,
      }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  (d, o) => ({}),
  (s, d, o) => ({...s}),
  'CoinFlip'
)(CoinFlip)
