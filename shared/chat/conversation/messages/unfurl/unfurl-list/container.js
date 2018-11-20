// @flow
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as I from 'immutable'
import {namedConnect} from '../../../../../util/container'
import UnfurlList from '.'

type OwnProps = {|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}

const mapStateToProps = (state, {conversationIDKey, ordinal}: OwnProps) => {
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
  return {
    unfurls: message && message.type === 'text' ? message.unfurls.toList() : I.List(),
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}: OwnProps) => ({
  onClose: (messageID: Types.MessageID) => {}, // TODO
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const unfurls = stateProps.unfurls
    .map(u => {
      return {
        unfurl: u.unfurl,
        url: u.url,
        // TODO
        onClose: undefined,
        // onClose: () => dispatchProps.onClose(Types.numberToMessageID(u.unfurlMessageID)),
      }
    })
    .toArray()
  return {
    unfurls,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'UnfurlList'
)(UnfurlList)
