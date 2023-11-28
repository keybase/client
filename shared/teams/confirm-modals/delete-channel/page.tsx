import * as React from 'react'
import type * as C from '@/constants'

const DeleteChan = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof DeleteChan>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <DeleteChan {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
