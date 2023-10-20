import * as React from 'react'

const Website = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <Website />
  </React.Suspense>
)
const Page = {getScreen: () => Screen}
export default Page
