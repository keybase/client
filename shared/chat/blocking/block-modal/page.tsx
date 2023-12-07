import * as React from 'react'
import * as C from '@/constants'

const Block = React.lazy(async () => import('./container'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Block>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p} canBeNull={true}>
      <Block {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
