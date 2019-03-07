// @flow
import CoinFlip from '.'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../../constants/chat2'
import {namedConnect} from '../../../../util/container'

type OwnProps = {|flipGameID: string|}

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
        isError: status.phase === RPCChatTypes.chatUiUICoinFlipPhase.error,
        isSendError: false,
        onFlipAgain: console.log('again'),
        participants: status.participants || [],
        phase: Constants.flipPhaseToString(status.phase),
        progressText: status.progressText,
        resultInfo: status.resultInfo,
        resultText: status.resultText,
        revealVis: status.revealVisualization,
        showParticipants: Constants.flipPhaseToString(status.phase) === 'complete',
      }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  (d, o) => ({}),
  (s, d, o) => ({...s}),
  'CoinFlip'
)(CoinFlip)
