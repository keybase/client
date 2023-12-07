import * as React from 'react'
import type * as C from '@/constants'

const Select = React.lazy(async () => import('./select-channel'))
type OwnProps = C.ViewPropsToPageProps<typeof Select>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Select {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
