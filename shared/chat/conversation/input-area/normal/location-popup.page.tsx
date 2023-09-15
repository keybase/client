import * as React from 'react'
import * as C from '../../../../constants'

const Location = React.lazy(async () => import('./location-popup'))
type OwnProps = C.ViewPropsToPageProps<typeof Location>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Location {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
