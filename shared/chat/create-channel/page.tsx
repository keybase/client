import * as React from 'react'
import type * as Container from '../../util/container'

const Channel = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Channel>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Channel {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
