import * as C from '../../../constants'
import * as React from 'react'
import type * as Container from '../../../util/container'

const Confirm = React.lazy(async () => import('./confirm'))
type OwnProps = Container.ViewPropsToPageProps<typeof Confirm>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Confirm {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
