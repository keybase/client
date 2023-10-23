import * as React from 'react'

const Enter = React.lazy(async () => import('./password-enter'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Enter />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
