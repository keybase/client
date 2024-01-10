import * as C from '@/constants'
import * as React from 'react'
import {headerNavigationOptions} from './header-area/container'

const getOptions = ({route}: OwnProps) => ({
  ...headerNavigationOptions(route),
  presentation: undefined,
})

const Convo = React.lazy(async () => import('./container'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Convo>>
const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p} canBeNull={true}>
      <Convo {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getOptions, getScreen: () => Screen}
export default Page
