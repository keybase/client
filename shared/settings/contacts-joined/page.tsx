import * as React from 'react'

const Joined = React.lazy(async () => import('.'))

const Screen = () => (
  <React.Suspense>
    <Joined />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
