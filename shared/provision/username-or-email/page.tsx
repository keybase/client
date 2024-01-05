import * as React from 'react'
import type * as C from '@/constants'

const UOE = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof UOE>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <UOE {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
