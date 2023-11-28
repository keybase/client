import * as React from 'react'
import type * as C from '@/constants'

const Confirm = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Confirm>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Confirm {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
