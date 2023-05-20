import * as React from 'react'
import type * as Container from '../../../util/container'

const AddToChan = React.lazy(async () => import('./add-to-channels'))
type OwnProps = Container.ViewPropsToPageProps<typeof AddToChan>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddToChan {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
