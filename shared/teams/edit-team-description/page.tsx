import * as React from 'react'
import type * as Container from '../../util/container'

const EditTeam = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof EditTeam>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <EditTeam {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
