import * as React from 'react'

const Known = React.lazy(async () => import('./password-known'))
const Screen = () => (
  <React.Suspense>
    <Known />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
