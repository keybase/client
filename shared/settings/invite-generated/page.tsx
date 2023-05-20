import * as React from 'react'
import type * as Container from '../../util/container'

const InviteGen = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof InviteGen>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <InviteGen {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
