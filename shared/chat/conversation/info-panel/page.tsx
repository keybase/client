import * as C from '../../../constants'
import * as React from 'react'

const Panel = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Panel>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Panel {...p.route.params} />
  </C.ProviderScreen>
)

const Page = {getScreen: () => Screen}
export default Page
