import * as React from 'react'
import type * as C from '@/constants'

const getOptions = {
  headerShadowVisible: false,
  headerTitle: '',
}

const Index = React.lazy(async () => import('./index.new'))
type OwnProps = C.ViewPropsToPageProps<typeof Index>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Index {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
