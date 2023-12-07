import * as React from 'react'
import type * as C from '@/constants'

const Remove = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Remove>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Remove {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
