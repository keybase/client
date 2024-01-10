import * as C from '@/constants'
import * as React from 'react'

const Panel = React.lazy(async () => import('.'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Panel>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <Panel {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
