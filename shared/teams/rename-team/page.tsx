import * as React from 'react'
import type * as Container from '../../util/container'

const Rename = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Rename>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Rename {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
