import * as React from 'react'

const Confirm = React.lazy(async () => import('./confirm'))

const getOptions = () => ({gesturesEnabled: false})

const Screen = () => (
  <React.Suspense>
    <Confirm />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
