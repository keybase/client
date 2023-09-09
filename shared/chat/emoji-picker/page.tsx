import * as React from 'react'
import * as C from '../../constants'

const Picker = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Picker>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Picker {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
