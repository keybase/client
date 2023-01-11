import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import CoinFlip, {type Props} from '.'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'

const noParticipants: Array<RPCChatTypes.UICoinFlipParticipant> = []
type PhaseType = Props['phase']

const CoinFlipContainer = React.memo(function CoinFlipContainer() {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)

  const message = Container.useSelector(state => state.chat2.messageMap.get(conversationIDKey)?.get(ordinal))
  const isSendError = message?.type === 'text' ? !!message.errorReason : false
  const text = message?.type === 'text' ? message.text : undefined
  const flipGameID = (message?.type === 'text' && message.flipGameID) || ''
  const status = Container.useSelector(state => state.chat2.flipStatusMap.get(flipGameID))
  const dispatch = Container.useDispatch()
  const onFlipAgain = React.useCallback(() => {
    text && dispatch(Chat2Gen.createMessageSend({conversationIDKey, text}))
  }, [dispatch, conversationIDKey, text])
  const props = !status
    ? {
        commitmentVis: '',
        errorInfo: null,
        isSendError,
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
