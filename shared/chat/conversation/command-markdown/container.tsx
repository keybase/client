import type * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import CommandMarkdown from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const md = state.chat2.commandMarkdownMap.get(ownProps.conversationIDKey)
    return {
      body: md?.body ?? '',
      title: md?.title ?? null,
    }
  },
  () => ({}),
  s => s
)(CommandMarkdown)
