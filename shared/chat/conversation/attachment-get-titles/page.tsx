import * as React from 'react'
import * as C from '../../../constants'
import type * as Container from '../../../util/container'

const Titles = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Titles>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Titles {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
