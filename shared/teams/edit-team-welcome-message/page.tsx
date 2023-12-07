import * as React from 'react'
import type * as C from '@/constants'

const Welcome = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Welcome>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Welcome {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
