import * as React from 'react'
import type * as C from '@/constants'

const EditChannel = React.lazy(async () => import('./edit-channel'))
type OwnProps = C.ViewPropsToPageProps<typeof EditChannel>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <EditChannel {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
