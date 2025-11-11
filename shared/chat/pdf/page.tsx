import * as React from 'react'
import * as C from '@/constants'

const Pdf = React.lazy(async () => import('.'))
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof Pdf>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <Pdf {...rest} />
    </C.Chat.ProviderScreen>
  )
}

export default {
  getOptions: C.isMobile ? undefined : {modal2: true, modal2Type: 'SuperWide'},
  screen: Screen,
}
