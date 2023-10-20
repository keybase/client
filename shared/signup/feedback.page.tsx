import * as React from 'react'

const Feedback = React.lazy(async () => import('./feedback'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Feedback />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
