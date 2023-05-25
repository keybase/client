import * as React from 'react'
import type * as Container from '../../util/container'

const Pick = React.lazy(async () => import('./pick-asset'))
type OwnProps = Container.ViewPropsToPageProps<typeof Pick>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Pick {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
