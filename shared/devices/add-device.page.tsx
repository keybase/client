import * as React from 'react'
import type * as C from '@/constants'

const Add = React.lazy(async () => import('./add-device'))
type OwnProps = C.ViewPropsToPageProps<typeof Add>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Add {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
