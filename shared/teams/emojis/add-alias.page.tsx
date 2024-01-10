import * as React from 'react'
import * as C from '@/constants'

const AddAlias = React.lazy(async () => import('./add-alias'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof AddAlias>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <AddAlias {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
