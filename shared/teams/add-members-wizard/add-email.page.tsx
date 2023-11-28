import * as React from 'react'
import type * as C from '@/constants'

const AddEmail = React.lazy(async () => import('./add-email'))
type OwnProps = C.ViewPropsToPageProps<typeof AddEmail>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddEmail {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
