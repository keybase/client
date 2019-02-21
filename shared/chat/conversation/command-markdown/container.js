// @flow
import * as Types from '../../../constants/types/chat2'
import {namedConnect} from '../../../util/container'
import CommandMarkdown from '.'

type OwnProps = {|conversationIDKey: Types.ConversationIDKey|}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  text: state.chat2.commandMarkdownMap.get(ownProps.conversationIDKey, ''),
  title: `*/flip* [options]
Flip a cryptographic coin`,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  (d, o) => ({}),
  (s, d, o) => s,
  'CommandMarkdown'
)(CommandMarkdown)
