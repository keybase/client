import * as Types from '../../../constants/types/chat2'
import {namedConnect} from '../../../util/container'
import CommandMarkdown from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default namedConnect(
  (state, ownProps: OwnProps) => {
    const md = state.chat2.commandMarkdownMap.get(ownProps.conversationIDKey)
    return {
      body: md ? md.body : '',
      title: md ? md.title : null,
    }
  },
  () => ({}),
  s => s,
  'CommandMarkdown'
)(CommandMarkdown)
