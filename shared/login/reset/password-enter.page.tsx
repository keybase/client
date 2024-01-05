import * as React from 'react'

const Enter = React.lazy(async () => import('./password-enter'))
const Screen = () => (
  <React.Suspense>
    <Enter />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
