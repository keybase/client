import * as React from 'react'
import type * as C from '@/constants'

const CreateChan = React.lazy(async () => import('./create-channels'))
type OwnProps = C.ViewPropsToPageProps<typeof CreateChan>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <CreateChan {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
