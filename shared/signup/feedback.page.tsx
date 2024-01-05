import * as React from 'react'

const Feedback = React.lazy(async () => import('./feedback'))

const Screen = () => (
  <React.Suspense>
    <Feedback />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
