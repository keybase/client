import * as React from 'react'
import type * as Container from '../../util/container'

const ReallyRemove = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof ReallyRemove>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <ReallyRemove {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
