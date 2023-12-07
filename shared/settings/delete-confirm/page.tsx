import * as React from 'react'

const Confirm = React.lazy(async () => import('.'))

const Screen = () => (
  <React.Suspense>
    <Confirm />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
