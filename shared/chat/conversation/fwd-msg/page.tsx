import * as React from 'react'
import * as C from '@/constants'

const Fwd = React.lazy(async () => import('./team-picker'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Fwd>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <Fwd {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
