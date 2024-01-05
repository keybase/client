import * as React from 'react'

const getOptions = {title: 'About'}

const About = React.lazy(async () => import('./about'))
const Screen = () => (
  <React.Suspense>
    <About />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
