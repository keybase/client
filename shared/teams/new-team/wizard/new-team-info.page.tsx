import * as React from 'react'

const Info = React.lazy(async () => import('./new-team-info'))

const Screen = () => (
  <React.Suspense>
    <Info />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
