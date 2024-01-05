import * as React from 'react'

const getOptions = {title: 'More'}

const Root = React.lazy(async () => import('./root-phone'))
const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
