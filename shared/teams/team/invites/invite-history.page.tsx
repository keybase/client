import * as React from 'react'
import type * as Container from '../../../util/container'

const Invite = React.lazy(async () => import('./invite-history'))
type OwnProps = Container.ViewPropsToPageProps<typeof Invite>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Invite {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
