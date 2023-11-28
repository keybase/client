import * as React from 'react'
import type * as C from '@/constants'

const Join = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Join>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Join {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
