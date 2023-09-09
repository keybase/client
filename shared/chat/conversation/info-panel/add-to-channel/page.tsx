import * as React from 'react'
import * as C from '../../../../constants'

const Add = React.lazy(async () => import('./index.new'))
type OwnProps = C.ViewPropsToPageProps<typeof Add>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Add {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
