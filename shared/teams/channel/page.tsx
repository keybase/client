import * as React from 'react'
import type * as C from '@/constants'

const getOptions = {
  headerHideBorder: true,
  headerTitle: '',
  underNotch: true,
}

const Channel = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Channel>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Channel {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
