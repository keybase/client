import * as React from 'react'
import type * as Container from '../../../util/container'

const Confirm = React.lazy(async () => import('./confirm'))
type OwnProps = Container.ViewPropsToPageProps<typeof Confirm>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Confirm {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
