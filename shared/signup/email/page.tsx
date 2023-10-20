import * as React from 'react'

const Email = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Email />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
