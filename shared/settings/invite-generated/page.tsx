import * as React from 'react'
import type * as C from '@/constants'

const InviteGen = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof InviteGen>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <InviteGen {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
