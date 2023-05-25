import * as React from 'react'
import type * as Container from '../../../util/container'

const Panel = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Panel>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Panel {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
