import * as React from 'react'

const AddPhone = React.lazy(async () => import('./add-phone'))

const Screen = () => (
  <React.Suspense>
    <AddPhone />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
