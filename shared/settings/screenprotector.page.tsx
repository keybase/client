import * as React from 'react'

const Root = React.lazy(async () => import('./screenprotector'))

const getOptions = () => ({
  header: undefined,
  title: 'Screen Protector',
})

const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
