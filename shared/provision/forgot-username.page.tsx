import * as React from 'react'

const Forgot = React.lazy(async () => import('./forgot-username'))
const Screen = () => (
  <React.Suspense>
    <Forgot />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
