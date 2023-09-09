import * as React from 'react'
import * as C from '../../../constants'

const Titles = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Titles>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Titles {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
