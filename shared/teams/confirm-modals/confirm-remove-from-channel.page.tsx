import * as React from 'react'
import type * as Container from '../../util/container'

const Remove = React.lazy(async () => import('./confirm-remove-from-channel'))
type OwnProps = Container.ViewPropsToPageProps<typeof Remove>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Remove {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
