import * as React from 'react'

const Scan = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <Scan />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
