import * as React from 'react'

const Name = React.lazy(async () => import('./device-name'))

const Screen = () => (
  <React.Suspense>
    <Name />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
