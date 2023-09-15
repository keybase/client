import * as C from '../../constants'
import * as React from 'react'
import {headerNavigationOptions} from './header-area/container'

const Convo = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Convo>

const getOptions = ({route}: OwnProps) => ({
  ...headerNavigationOptions(route),
  presentation: undefined,
})

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p} canBeNull={true}>
    <Convo {...p.route.params} />
  </C.ProviderScreen>
)

export default {getOptions, getScreen: () => Screen}
