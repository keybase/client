import * as React from 'react'
import * as C from '@/constants'

const Popup = React.lazy(async () => import('./map-popup'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Popup>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <Popup {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
