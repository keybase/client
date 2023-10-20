import * as React from 'react'

const Channel = React.lazy(async () => import('./add-from-where'))

const Screen = () => (
  <React.Suspense>
    <Channel />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
