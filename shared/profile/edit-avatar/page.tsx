import * as React from 'react'
import type * as C from '@/constants'

const EditAvatar = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof EditAvatar>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <EditAvatar {...p.route.params} />
  </React.Suspense>
)
const Page = {getScreen: () => Screen}
export default Page
