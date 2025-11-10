import * as React from 'react'
import * as C from '@/constants'

const Titles = React.lazy(async () => import('./container'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Titles>>

export default {
  screen: (p: OwnProps) => {
    const {conversationIDKey, ...rest} = p.route.params
    return (
      <C.Chat.ProviderScreen rp={p}>
        <Titles {...rest} />
      </C.Chat.ProviderScreen>
    )
  },
}
