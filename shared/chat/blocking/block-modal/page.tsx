import * as React from 'react'
import * as C from '../../../constants'

const Block = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Block>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p} canBeNull={true}>
    <Block {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
