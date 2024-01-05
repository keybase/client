import * as React from 'react'

const getOptions = {
  title: 'Display',
}

const Display = React.lazy(async () => import('./display'))
const Screen = () => (
  <React.Suspense>
    <Display />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
