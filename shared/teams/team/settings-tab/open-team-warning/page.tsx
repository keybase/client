import * as React from 'react'
import type * as C from '@/constants'

const OpenTW = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof OpenTW>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <OpenTW {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
