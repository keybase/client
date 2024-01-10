import * as React from 'react'
import * as C from '@/constants'

const Block = React.lazy(async () => import('./container'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Block>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p} canBeNull={true}>
      <Block {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
