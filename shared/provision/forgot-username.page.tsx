import * as React from 'react'

const Forgot = React.lazy(async () => import('./forgot-username'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Forgot />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
