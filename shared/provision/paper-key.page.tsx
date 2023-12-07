import * as React from 'react'

const Paper = React.lazy(async () => import('./paper-key'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Paper />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
