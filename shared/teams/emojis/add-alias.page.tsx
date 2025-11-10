import * as React from 'react'
import * as C from '@/constants'

const AddAlias = React.lazy(async () => import('./add-alias'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof AddAlias>>

export default {
  screen: (p: OwnProps) => {
    const {conversationIDKey, ...rest} = p.route.params
    return (
      <C.Chat.ProviderScreen rp={p}>
        <AddAlias {...rest} />
      </C.Chat.ProviderScreen>
    )
  },
}
