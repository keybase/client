import * as React from 'react'
import type * as C from '../../../../../../constants'

const Popup = React.lazy(async () => import('./map-popup'))
type OwnProps = C.ViewPropsToPageProps<typeof Popup>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Popup {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
