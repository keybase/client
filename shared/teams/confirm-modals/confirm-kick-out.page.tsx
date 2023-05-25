import * as React from 'react'
import type * as Container from '../../util/container'

const Kick = React.lazy(async () => import('./confirm-kick-out'))
type OwnProps = Container.ViewPropsToPageProps<typeof Kick>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Kick {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
