import * as React from 'react'
import type * as Container from '../../../../../../util/container'

const Popup = React.lazy(async () => import('./map-popup'))
type OwnProps = Container.ViewPropsToPageProps<typeof Popup>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Popup {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
