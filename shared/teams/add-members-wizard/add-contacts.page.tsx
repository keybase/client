import * as React from 'react'
import type * as Container from '../../util/container'

const AddContacts = React.lazy(async () => import('./add-contacts'))
type OwnProps = Container.ViewPropsToPageProps<typeof AddContacts>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddContacts {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
