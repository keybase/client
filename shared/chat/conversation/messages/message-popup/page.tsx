import * as React from 'react'
import type * as Container from '../../../../util/container'

const PopupModal = React.lazy(async () => {
  const {MessagePopupModal} = await import('.')
  return {default: MessagePopupModal}
})
type OwnProps = Container.ViewPropsToPageProps<typeof PopupModal>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <PopupModal {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
