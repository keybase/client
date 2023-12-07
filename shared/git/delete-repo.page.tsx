import * as React from 'react'
import type * as C from '@/constants'

const Delete = React.lazy(async () => import('./delete-repo'))
type OwnProps = C.ViewPropsToPageProps<typeof Delete>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Delete {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
