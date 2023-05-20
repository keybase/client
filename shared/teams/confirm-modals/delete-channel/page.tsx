import * as React from 'react'
import type * as Container from '../../../util/container'

const DeleteChan = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof DeleteChan>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <DeleteChan {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
