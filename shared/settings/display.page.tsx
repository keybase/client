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

export default {getOptions, getScreen: () => Screen}
