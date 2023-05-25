import * as React from 'react'
import type * as Container from '../util/container'

const Add = React.lazy(async () => import('./add-device'))
type OwnProps = Container.ViewPropsToPageProps<typeof Add>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Add {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
