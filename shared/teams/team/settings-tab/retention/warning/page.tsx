import * as React from 'react'
import type * as C from '@/constants'

const Warning = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Warning>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Warning {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
