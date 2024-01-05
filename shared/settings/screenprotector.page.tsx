import * as React from 'react'

const getOptions = {
  header: undefined,
  title: 'Screen Protector',
}

const Root = React.lazy(async () => import('./screenprotector'))
const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
