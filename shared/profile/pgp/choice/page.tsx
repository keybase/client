import * as React from 'react'

const Choice = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Choice />
  </React.Suspense>
)
const Page = {getScreen: () => Screen}
export default Page
