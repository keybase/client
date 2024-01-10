import * as React from 'react'
import * as C from '@/constants'

const PopupModal = React.lazy(async () => {
  const {MessagePopupModal} = await import('.')
  return {default: MessagePopupModal}
})
type OwnProps = C.Chat.ChatProviderProps<C.ViewPropsToPageProps<typeof PopupModal>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.Chat.ProviderScreen rp={p}>
      <PopupModal {...rest} />
    </C.Chat.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
