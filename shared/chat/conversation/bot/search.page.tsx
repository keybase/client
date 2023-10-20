import * as React from 'react'
import * as C from '../../../constants'

const Search = React.lazy(async () => import('./search'))
type OwnProps = C.ViewPropsToPageProps<typeof Search>

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Search {...p.route.params} />
  </C.ProviderScreen>
)

const Page = {getScreen: () => Screen}
export default Page
