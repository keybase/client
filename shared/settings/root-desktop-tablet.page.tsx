import * as React from 'react'

const getOptions = {title: 'Settings'}

const Root = React.lazy(async () => import('./root-desktop-tablet'))
const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen, skipShim: true}
export default Page
