import * as React from 'react'

const Paper = React.lazy(async () => import('./paper-key'))
const Screen = () => (
  <React.Suspense>
    <Paper />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
