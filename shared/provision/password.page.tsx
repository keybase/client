import * as React from 'react'

const PWD = React.lazy(async () => import('./password'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <PWD />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
