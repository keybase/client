import * as React from 'react'
import * as C from '../../../../constants'
import type * as Container from '../../../../util/container'

const Location = React.lazy(async () => import('./location-popup'))
type OwnProps = Container.ViewPropsToPageProps<typeof Location>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Location {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
