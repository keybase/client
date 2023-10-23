import * as React from 'react'

const Display = React.lazy(async () => import('./display'))

const getOptions = () => ({
  header: undefined,
  title: 'Display',
})

const Screen = () => (
  <React.Suspense>
    <Display />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
