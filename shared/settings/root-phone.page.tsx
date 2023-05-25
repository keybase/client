import * as React from 'react'

const Root = React.lazy(async () => import('./root-phone'))
const getOptions = () => ({title: 'More'})

const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
