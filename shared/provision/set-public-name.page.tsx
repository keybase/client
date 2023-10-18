import * as React from 'react'

const Name = React.lazy(async () => import('./set-public-name'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Name />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
