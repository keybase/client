import * as React from 'react'
import type * as Container from '../../util/container'

const Disable = React.lazy(async () => {
  const {DeleteModal} = await import('./confirm-delete')
  return {default: DeleteModal}
})

type OwnProps = Container.ViewPropsToPageProps<typeof Disable>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Disable {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
