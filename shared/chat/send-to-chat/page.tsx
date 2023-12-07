import * as React from 'react'
import type * as C from '@/constants'

const Send = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Send>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Send {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
