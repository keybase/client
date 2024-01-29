import * as React from 'react'
import * as C from '@/constants'
import {useWindowDimensions} from 'react-native'

const getOptions = {
  ...(C.isIOS ? {orientation: 'all', presentation: 'transparentModal'} : {}),
  safeAreaStyle: {
    backgroundColor: 'black', // true black
  },
}

const Full = React.lazy(async () => import('.'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Full>>
const Screen = (p: OwnProps) => {
  const {width, height} = useWindowDimensions()
  const isPortrait = height > width
  // reset zoom etc on change
  const [key, setKey] = React.useState(0)

  React.useEffect(() => {
    setKey(k => k + 1)
  }, [isPortrait])

  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <Full {...rest} showHeader={isPortrait} key={String(key)} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getOptions, getScreen: () => Screen}
export default Page
