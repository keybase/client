import * as React from 'react'
import type * as Container from '../../util/container'

const AddEmoji = React.lazy(async () => import('./add-emoji'))
type OwnProps = Container.ViewPropsToPageProps<typeof AddEmoji>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddEmoji {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
