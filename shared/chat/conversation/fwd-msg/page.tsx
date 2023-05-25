import * as React from 'react'
import type * as Container from '../../../util/container'

const Fwd = React.lazy(async () => import('./team-picker'))
type OwnProps = Container.ViewPropsToPageProps<typeof Fwd>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Fwd {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
