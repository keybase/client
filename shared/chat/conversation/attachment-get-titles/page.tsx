import * as React from 'react'
import * as C from '@/constants'

const Titles = React.lazy(async () => import('./container'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Titles>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <Titles {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page