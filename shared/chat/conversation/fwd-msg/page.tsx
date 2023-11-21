import * as React from 'react'
import * as C from '../../../constants'

const Fwd = React.lazy(async () => import('./team-picker'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Fwd>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <Fwd {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
