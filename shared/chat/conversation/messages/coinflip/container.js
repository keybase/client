// @flow
import CoinFlip from '.'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../../constants/chat2'
import {namedConnect} from '../../../../util/container'
import openURL from '../../../../util/open-url'

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
        participants: status.participants || [],
        phase: Constants.flipPhaseToString(status.phase),
        progressText: status.progressText,
        resultInfo: status.resultInfo,
        resultText: status.resultText,
        revealVis: status.revealVisualization,
        showParticipants: Constants.flipPhaseToString(status.phase) === 'complete',
      }
}

const mapDispatchToProps = (dispatch) => ({
  onReadMore: () => {
    openURL('https://keybase.io/blog/cryptographic-coin-flipping#what-if-someone-loses-network-before-the-secret-stage-')
  },
})

const mergeProps = (stateProps, dispatchProps) => {
  return {...stateProps, ...dispatchProps}
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'CoinFlip'
)(CoinFlip)
