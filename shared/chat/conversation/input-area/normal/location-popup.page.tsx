import * as React from 'react'
import type * as Container from '../../../../util/container'

const Location = React.lazy(async () => import('./location-popup'))
type OwnProps = Container.ViewPropsToPageProps<typeof Location>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Location {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
