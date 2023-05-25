import * as React from 'react'
import type * as Container from '../../util/container'

const Receive = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Receive>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Receive {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
