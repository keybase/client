import * as React from 'react'
import * as C from '../../../../constants'

const PopupModal = React.lazy(async () => {
  const {MessagePopupModal} = await import('.')
  return {default: MessagePopupModal}
})
type OwnProps = C.ViewPropsToPageProps<typeof PopupModal>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <PopupModal {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
