import * as React from 'react'

const Archive = React.lazy(async () => import('.'))

const Screen = () => (
  <React.Suspense>
    <Archive />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
