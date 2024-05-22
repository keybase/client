import * as C from '@/constants'
import * as React from 'react'

const Confirm = React.lazy(async () => import('./confirm'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Confirm>>

const Screen = (p: OwnProps) => {
  const rest = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p} canBeNull={true}>
      <Confirm {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
