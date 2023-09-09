import * as React from 'react'
import * as C from '../../../constants'

const Fwd = React.lazy(async () => import('./team-picker'))
type OwnProps = C.ViewPropsToPageProps<typeof Fwd>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Fwd {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
