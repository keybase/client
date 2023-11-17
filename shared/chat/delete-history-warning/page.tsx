import * as C from '../../constants'
import * as React from 'react'

const Warning = React.lazy(async () => import('./container'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Warning>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <Warning {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
