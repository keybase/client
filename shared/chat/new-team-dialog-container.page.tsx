import * as React from 'react'
import * as C from '@/constants'

const New = React.lazy(async () => import('./new-team-dialog-container'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof New>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <New {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
