import * as React from 'react'
import * as C from '@/constants'

const Add = React.lazy(async () => import('./index.new'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Add>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <Add {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
