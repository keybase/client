import * as React from 'react'
import type * as C from '../../constants'

const EditTeam = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof EditTeam>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <EditTeam {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
