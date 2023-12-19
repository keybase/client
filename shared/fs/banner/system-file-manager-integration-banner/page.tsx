import * as React from 'react'

const Perms = React.lazy(async () => import('./kext-permission-popup'))

const Screen = () => (
  <React.Suspense>
    <Perms />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
