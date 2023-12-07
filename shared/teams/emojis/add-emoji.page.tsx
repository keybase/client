import * as React from 'react'
import type * as C from '@/constants'

const AddEmoji = React.lazy(async () => import('./add-emoji'))
type OwnProps = C.ViewPropsToPageProps<typeof AddEmoji>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddEmoji {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
