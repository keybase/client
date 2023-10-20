import * as C from '../../constants'
import * as React from 'react'

const Warning = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Warning>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Warning {...p.route.params} />
  </C.ProviderScreen>
)

const Page = {getScreen: () => Screen}
export default Page
