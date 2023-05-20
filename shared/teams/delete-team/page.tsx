import * as React from 'react'
import type * as Container from '../../util/container'

const DeleteTeam = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof DeleteTeam>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <DeleteTeam {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
