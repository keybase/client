import * as C from '../../../constants'
import * as React from 'react'
import type * as Container from '../../../util/container'

const Panel = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Panel>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Panel {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
