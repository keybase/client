import * as React from 'react'

const About = React.lazy(async () => import('./about'))

const getOptions = () => ({
  header: undefined,
  title: 'About',
})

const Screen = () => (
  <React.Suspense>
    <About />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
