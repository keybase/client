import * as React from 'react'
import type * as C from '@/constants'

const Revoke = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Revoke>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Revoke {...p.route.params} />
  </React.Suspense>
)
const Page = {getScreen: () => Screen}
export default Page
