import * as React from 'react'
import type * as Container from '../../../util/container'

const Leave = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Leave>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Leave {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
