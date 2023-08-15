import * as React from 'react'
import * as C from '../../../constants'
import type * as Container from '../../../util/container'

const Full = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Full>

const getOptions = () => ({
  safeAreaStyle: {
    backgroundColor: 'black', // true black
  },
})

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Full {...p.route.params} />
  </C.ProviderScreen>
)

export default {getOptions, getScreen: () => Screen}
