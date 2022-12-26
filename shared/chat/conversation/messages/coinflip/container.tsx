import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import CoinFlip, {type Props} from '.'
import type * as Types from '../../../../constants/types/chat2'
import type HiddenString from '../../../../util/hidden-string'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  measure?: () => void
  isSendError: boolean
  flipGameID: string
  text: HiddenString
}

const noParticipants: Array<RPCChatTypes.UICoinFlipParticipant> = []
type PhaseType = Props['phase']

const CoinFlipContainer = React.memo(function CoinFlipContainer(p: OwnProps) {
  const {conversationIDKey, measure, isSendError, flipGameID, text} = p
  const status = Container.useSelector(state => state.chat2.flipStatusMap.get(flipGameID))
  const dispatch = Container.useDispatch()
  const onFlipAgain = React.useCallback(
    () => dispatch(Chat2Gen.createMessageSend({conversationIDKey, text})),
    [dispatch, conversationIDKey, text]
  )
  const props = !status
    ? {
        commitmentVis: '',
        errorInfo: null,
        isSendError,
        measure,
        onFlipAgain,
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
        measure,
        onFlipAgain,
        participants: status.participants || noParticipants,
        phase: Constants.flipPhaseToString(status.phase) as PhaseType,
        progressText: status.progressText,
        resultInfo: status.resultInfo,
        resultText: status.resultText,
        revealVis: status.revealVisualization,
        showParticipants: Constants.flipPhaseToString(status.phase) === 'complete',
      }

  return <CoinFlip {...props} />
})

export default CoinFlipContainer
