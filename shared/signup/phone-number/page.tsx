import * as React from 'react'

const Phone = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Phone />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
