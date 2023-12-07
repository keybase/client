import * as React from 'react'

const Join = React.lazy(async () => import('./join-from-invite'))

const Screen = () => (
  <React.Suspense>
    <Join />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
