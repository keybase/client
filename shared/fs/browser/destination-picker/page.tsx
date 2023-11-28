import * as React from 'react'
import type * as C from '@/constants'

const Picker = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Picker>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Picker {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
