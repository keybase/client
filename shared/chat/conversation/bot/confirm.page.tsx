import * as C from '../../../constants'
import * as React from 'react'

const Confirm = React.lazy(async () => import('./confirm'))
type OwnProps = C.ViewPropsToPageProps<typeof Confirm>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Confirm {...p.route.params} />
  </C.ProviderScreen>
)

const Page = {getScreen: () => Screen}
export default Page
