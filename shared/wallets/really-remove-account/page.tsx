import * as React from 'react'
import type * as C from '@/constants'

const ReallyRemove = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof ReallyRemove>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <ReallyRemove {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
