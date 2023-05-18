import * as React from 'react'
import type * as Container from '../util/container'

const New = React.lazy(async () => import('./new-repo'))
type OwnProps = Container.ViewPropsToPageProps<typeof New>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <New {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
