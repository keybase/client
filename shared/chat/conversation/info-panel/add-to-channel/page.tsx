import * as React from 'react'
import * as C from '../../../../constants'
import type * as Container from '../../../../util/container'

const Add = React.lazy(async () => import('./index.new'))
type OwnProps = Container.ViewPropsToPageProps<typeof Add>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Add {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
