import * as React from 'react'
import type * as C from '@/constants'

const Leave = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Leave>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Leave {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
