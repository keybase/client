import * as React from 'react'

const Generate = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Generate />
  </React.Suspense>
)
const Page = {getScreen: () => Screen}
export default Page
