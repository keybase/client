import * as React from 'react'

const AddSubMem = React.lazy(async () => import('./add-subteam-members'))

const Screen = () => (
  <React.Suspense>
    <AddSubMem />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
