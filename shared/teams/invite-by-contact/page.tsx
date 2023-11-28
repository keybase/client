import * as React from 'react'
import type * as C from '@/constants'

const Invite = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Invite>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Invite {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
