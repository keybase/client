import * as Types from '../../../constants/types/chat2'
import {namedConnect} from '../../../util/container'
import CommandMarkdown from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const md = state.chat2.commandMarkdownMap.get(ownProps.conversationIDKey, null)
  return {
    body: md ? md.body : '',
    title: md ? md.title : null,
  }
}

export default namedConnect(mapStateToProps, () => ({}), s => s, 'CommandMarkdown')(CommandMarkdown)
