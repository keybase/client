import * as React from 'react'

const Scan = React.lazy(async () => import('./container'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Scan />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
