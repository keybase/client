import * as React from 'react'
import type * as Container from '../../../util/container'

const Titles = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Titles>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Titles {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
