import * as React from 'react'

const ShowCase = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <ShowCase />
  </React.Suspense>
)
const Page = {getScreen: () => Screen}
export default Page
