import * as C from '../../constants'
import * as React from 'react'
import type * as Container from '../../util/container'

const Warning = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Warning>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Warning {...p.route.params} />
  </C.ProviderScreen>
)

export default {getScreen: () => Screen}
