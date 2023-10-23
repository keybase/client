import * as React from 'react'

const Invites = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Invites />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
