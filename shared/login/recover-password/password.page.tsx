import * as React from 'react'

const Password = React.lazy(async () => import('./password'))

const getOptions = () => ({gesturesEnabled: false})

const Screen = () => (
  <React.Suspense>
    <Password />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
