import * as React from 'react'
import type * as Container from '../util/container'

const Delete = React.lazy(async () => import('./delete-repo'))
type OwnProps = Container.ViewPropsToPageProps<typeof Delete>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Delete {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
