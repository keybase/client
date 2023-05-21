import * as React from 'react'
import type * as Container from '../../util/container'

const Onboard = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Onboard>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Onboard {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
