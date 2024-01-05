import * as React from 'react'

const getOptions = {title: 'Your account'}

const Account = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Account />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
