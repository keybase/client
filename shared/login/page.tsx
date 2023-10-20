import * as React from 'react'

const Root = React.lazy(async () => import('.'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
