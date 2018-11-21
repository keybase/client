// @flow
import * as Constants from '../../../../../constants/chat2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Types from '../../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as I from 'immutable'
import {namedConnect} from '../../../../../util/container'
import UnfurlPromptList from '.'

type OwnProps = {|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}

const noPrompts = I.Set()
const noMessageID = Types.numberToMessageID(0)

const mapStateToProps = (state, {conversationIDKey, ordinal}: OwnProps) => {
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
  const messageID = message && message.type === 'text' ? message.id : noMessageID
  const promptDomains = state.chat2.unfurlPromptMap.getIn([conversationIDKey, messageID]) || noPrompts
  return {
    promptDomains,
    messageID,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}: OwnProps) => ({
  _setPolicy: (messageID: Types.MessageID, domain: string, result: RPCChatTypes.UnfurlPromptResult) => {
    dispatch(
      Chat2Gen.createUnfurlResolvePrompt({
        conversationIDKey,
        messageID,
        domain,
        result,
      })
    )
  },
})

const makeRes = (actionType: RPCChatTypes.UnfurlPromptAction, domain?: string) => {
  return {actionType, accept: domain}
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  prompts: stateProps.promptDomains
    .map(domain => ({
      domain,
      onAlways: () =>
        dispatchProps._setPolicy(
          stateProps.messageID,
          domain,
          // $FlowIssue generated type hard to match
          makeRes(RPCChatTypes.localUnfurlPromptAction.always)
        ),
      onNever: () =>
        dispatchProps._setPolicy(
          stateProps.messageID,
          domain,
          // $FlowIssue generated type hard to match
          makeRes(RPCChatTypes.localUnfurlPromptAction.never)
        ),
      onNotnow: () =>
        dispatchProps._setPolicy(
          stateProps.messageID,
          domain,
          // $FlowIssue generated type hard to match
          makeRes(RPCChatTypes.localUnfurlPromptAction.notnow)
        ),
      onAccept: () =>
        dispatchProps._setPolicy(
          stateProps.messageID,
          domain,
          // $FlowIssue generated type hard to match
          makeRes(RPCChatTypes.localUnfurlPromptAction.accept, domain)
        ),
    }))
    .toArray(),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'UnfurlPromptList'
)(UnfurlPromptList)
