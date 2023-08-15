import * as React from 'react'
import * as C from '../../../../constants'
import type * as Container from '../../../../util/container'

const PopupModal = React.lazy(async () => {
  const {MessagePopupModal} = await import('.')
  return {default: MessagePopupModal}
})
type OwnProps = Container.ViewPropsToPageProps<typeof PopupModal>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey}>
      <PopupModal {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
