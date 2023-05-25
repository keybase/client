import * as React from 'react'
import type * as Container from '../../util/container'

const AddAlias = React.lazy(async () => import('./add-alias'))
type OwnProps = Container.ViewPropsToPageProps<typeof AddAlias>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddAlias {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
