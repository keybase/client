import * as React from 'react'
import type * as Container from '../../util/container'

const Revoke = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Revoke>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Revoke {...p.route.params} />
  </React.Suspense>
)
export default {getScreen: () => Screen}
