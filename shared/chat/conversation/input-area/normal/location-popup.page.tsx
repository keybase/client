import * as React from 'react'
import * as C from '@/constants'

const Location = React.lazy(async () => import('./location-popup'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Location>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <Location {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
