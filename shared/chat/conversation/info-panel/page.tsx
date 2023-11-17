import * as C from '../../../constants'
import * as React from 'react'

const Panel = React.lazy(async () => import('.'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Panel>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <Panel {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
