import * as React from 'react'
import type * as C from '@/constants'

const AddToChan = React.lazy(async () => import('./add-to-channels'))
type OwnProps = C.ViewPropsToPageProps<typeof AddToChan>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddToChan {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
