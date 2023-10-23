import * as React from 'react'

const EditProfile = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <EditProfile />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
