import * as React from 'react'
import * as C from '@/constants'

const getOptions = {
  ...(C.isIOS ? {presentation: 'transparentModal'} : {}),
  safeAreaStyle: {
    backgroundColor: 'black', // true black
  },
}

const Full = React.lazy(async () => import('.'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Full>>
const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <Full {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getOptions, getScreen: () => Screen}
export default Page
