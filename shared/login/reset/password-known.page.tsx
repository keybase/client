import * as React from 'react'

const Known = React.lazy(async () => import('./password-known'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Known />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
