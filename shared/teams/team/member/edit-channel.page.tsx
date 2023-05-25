import * as React from 'react'
import type * as Container from '../../../util/container'

const EditChannel = React.lazy(async () => import('./edit-channel'))
type OwnProps = Container.ViewPropsToPageProps<typeof EditChannel>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <EditChannel {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
