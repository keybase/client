import * as React from 'react'

const PWD = React.lazy(async () => import('./password'))
const Screen = () => (
  <React.Suspense>
    <PWD />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
