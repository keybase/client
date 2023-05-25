import * as React from 'react'
import type * as Container from '../../util/container'

const AddEmail = React.lazy(async () => import('./add-email'))
type OwnProps = Container.ViewPropsToPageProps<typeof AddEmail>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddEmail {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
