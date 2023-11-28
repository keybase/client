import * as C from '@/constants'
import CommandMarkdown from '.'

const Container = () => {
  const md = C.useChatContext(s => s.commandMarkdown)
  const body = md?.body ?? ''
  const title = md?.title ?? undefined
  const props = {body, title}
  return <CommandMarkdown {...props} />
}
export default Container
