import * as React from 'react'
import * as C from '@/constants'

const Popup = React.lazy(async () => import('./map-popup'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Popup>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <Popup {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
