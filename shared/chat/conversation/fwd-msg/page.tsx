import * as React from 'react'
import * as C from '../../../constants'
import type * as Container from '../../../util/container'

const Fwd = React.lazy(async () => import('./team-picker'))
type OwnProps = Container.ViewPropsToPageProps<typeof Fwd>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Fwd {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
