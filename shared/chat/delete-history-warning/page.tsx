import * as C from '@/constants'
import * as React from 'react'

const Warning = React.lazy(async () => import('./container'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Warning>>

export default {
  screen: (p: OwnProps) => {
    const {conversationIDKey, ...rest} = p.route.params
    return (
      <C.Chat.ProviderScreen rp={p}>
        <Warning {...rest} />
      </C.Chat.ProviderScreen>
    )
  },
}
