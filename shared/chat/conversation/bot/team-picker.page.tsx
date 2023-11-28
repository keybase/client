import * as React from 'react'
import type * as C from '@/constants'

const Install = React.lazy(async () => import('./install'))
type OwnProps = C.ViewPropsToPageProps<typeof Install>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Install {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
