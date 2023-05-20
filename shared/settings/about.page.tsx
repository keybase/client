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

export default {getOptions, getScreen: () => Screen}
