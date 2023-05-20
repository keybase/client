import * as React from 'react'
import type * as Container from '../../util/container'

const TeamInfo = React.lazy(async () => import('./team-info'))
type OwnProps = Container.ViewPropsToPageProps<typeof TeamInfo>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <TeamInfo {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
