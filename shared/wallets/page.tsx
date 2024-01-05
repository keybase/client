import * as React from 'react'

const getOptions = {title: 'Wallet'}

const Index = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Index />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
