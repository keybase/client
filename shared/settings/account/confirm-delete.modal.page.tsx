import * as React from 'react'
import type * as C from '@/constants'

const Disable = React.lazy(async () => {
  const {DeleteModal} = await import('./confirm-delete')
  return {default: DeleteModal}
})
type OwnProps = C.ViewPropsToPageProps<typeof Disable>

export default {screen: (p: OwnProps) => <Disable {...p.route.params} />}
