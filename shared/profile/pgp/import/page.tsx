import * as React from 'react'

const Import = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Import />
  </React.Suspense>
)
const Page = {getScreen: () => Screen}
export default Page
