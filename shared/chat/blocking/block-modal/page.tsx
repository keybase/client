import * as React from 'react'
import * as C from '@/constants'

const Block = React.lazy(async () => import('./container'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Block>>

const Screen = (p: OwnProps) => {
  return (
    <C.Chat.ProviderScreen rp={p} canBeNull={true}>
      <Block {...p.route.params} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
