import * as React from 'react'
import * as C from '../../../constants'
import type * as Container from '../../../util/container'

const Search = React.lazy(async () => import('./search'))
type OwnProps = Container.ViewPropsToPageProps<typeof Search>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Search {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
