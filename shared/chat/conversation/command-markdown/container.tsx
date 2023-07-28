import * as Constants from '../../../constants/chat2'
import CommandMarkdown from '.'

export default () => {
  const md = Constants.useContext(s => s.commandMarkdown)
  const body = md?.body ?? ''
  const title = md?.title ?? undefined
  const props = {body, title}
  return <CommandMarkdown {...props} />
}
