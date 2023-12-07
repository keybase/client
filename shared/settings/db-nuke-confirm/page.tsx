import * as React from 'react'

const Nuke = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Nuke />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
