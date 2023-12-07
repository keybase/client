import * as React from 'react'

const ProofsList = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <ProofsList />
  </React.Suspense>
)
const Page = {getScreen: () => Screen}
export default Page
