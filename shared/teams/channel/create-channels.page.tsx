import * as React from 'react'
import type * as Container from '../../util/container'

const CreateChan = React.lazy(async () => import('./create-channels'))
type OwnProps = Container.ViewPropsToPageProps<typeof CreateChan>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <CreateChan {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
