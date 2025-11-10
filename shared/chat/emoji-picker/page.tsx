import * as React from 'react'
import * as C from '@/constants'

const Picker = React.lazy(async () => import('./container'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Picker>>

export default {
  screen: (p: OwnProps) => {
    const {conversationIDKey, ...rest} = p.route.params
    return (
      <C.Chat.ProviderScreen rp={p}>
        <Picker {...rest} />
      </C.Chat.ProviderScreen>
    )
  },
}
