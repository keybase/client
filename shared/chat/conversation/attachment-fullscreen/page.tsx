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
    <C.ProviderScreen rp={p}>
      <Full {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getOptions, getScreen: () => Screen}
export default Page
