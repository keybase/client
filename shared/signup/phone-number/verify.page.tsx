import * as React from 'react'

const Verify = React.lazy(async () => import('./verify-container'))

const Screen = () => (
  <React.Suspense>
    <Verify />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
