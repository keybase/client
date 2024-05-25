import * as React from 'react'
import * as C from '@/constants'

const getOptions = {
  headerShadowVisible: false,
  headerTitle: '',
  underNotch: true,
}

const Channel = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Channel>
const Screen = (p: OwnProps) => (
  <C.Chat.ProviderScreen rp={p}>
    <Channel {...p.route.params} />
  </C.Chat.ProviderScreen>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
