import * as React from 'react'
import * as C from '@/constants'

const getOptions = C.isMobile ? undefined : {modal2: true, modal2Type: 'SuperWide'}

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

const Page = {getOptions, getScreen: () => Screen}
export default Page
