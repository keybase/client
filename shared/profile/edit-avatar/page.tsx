import * as React from 'react'
import type * as Container from '../../util/container'

const EditAvatar = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof EditAvatar>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <EditAvatar {...p.route.params} />
  </React.Suspense>
)
export default {getScreen: () => Screen}
