import * as React from 'react'

const Root = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
