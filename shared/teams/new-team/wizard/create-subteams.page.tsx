import * as React from 'react'

const CreateSub = React.lazy(async () => import('./create-subteams'))

const Screen = () => (
  <React.Suspense>
    <CreateSub />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
