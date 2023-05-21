import * as React from 'react'
import type * as Container from '../../util/container'

const Join = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Join>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Join {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
