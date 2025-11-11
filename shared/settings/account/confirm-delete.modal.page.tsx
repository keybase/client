import * as React from 'react'
import type * as C from '@/constants'

const Disable = React.lazy(async () => {
  const {DeleteModal} = await import('./confirm-delete')
  return {default: DeleteModal}
})
type OwnProps = C.ViewPropsToPageProps<typeof Disable>

const Screen = (p: OwnProps) => <Disable {...p.route.params} />

export default {screen: Screen}
