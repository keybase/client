import * as React from 'react'

const Index = React.lazy(async () => import('.'))

const getOptions = () => {
  return {title: 'Wallet'}
}

const Screen = () => (
  <React.Suspense>
    <Index />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
