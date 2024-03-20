import * as React from 'react'
import * as C from '@/constants'

const Search = React.lazy(async () => import('./search'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Search>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p} canBeNull={true}>
      <Search {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
