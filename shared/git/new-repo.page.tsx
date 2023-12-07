import * as React from 'react'
import type * as C from '@/constants'

const New = React.lazy(async () => import('./new-repo'))
type OwnProps = C.ViewPropsToPageProps<typeof New>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <New {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
