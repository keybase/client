import * as React from 'react'
import type * as C from '@/constants'

const Gen = React.lazy(async () => import('./generate-link'))
type OwnProps = C.ViewPropsToPageProps<typeof Gen>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Gen {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
