import * as React from 'react'
import type * as C from '../../constants'

const AddAlias = React.lazy(async () => import('./add-alias'))
type OwnProps = C.ViewPropsToPageProps<typeof AddAlias>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddAlias {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
