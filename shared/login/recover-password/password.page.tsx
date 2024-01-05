import * as React from 'react'

const getOptions = {gesturesEnabled: false}

const Password = React.lazy(async () => import('./password'))
const Screen = () => (
  <React.Suspense>
    <Password />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
