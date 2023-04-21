import type * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import CommandMarkdown from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

export default (ownProps: OwnProps) => {
  const md = Container.useSelector(state => state.chat2.commandMarkdownMap.get(ownProps.conversationIDKey))
  const body = md?.body ?? ''
  const title = md?.title ?? null
  const props = {body, title}
  return <CommandMarkdown {...props} />
}
