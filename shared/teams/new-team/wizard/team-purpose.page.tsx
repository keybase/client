import * as React from 'react'

const Purpose = React.lazy(async () => import('./team-purpose'))

const Screen = () => (
  <React.Suspense>
    <Purpose />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
