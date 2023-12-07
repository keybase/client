import * as React from 'react'

const Error = React.lazy(async () => import('./error'))

const getOptions = () => ({
  headerLeft: undefined,
})

const Screen = () => (
  <React.Suspense>
    <Error />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
