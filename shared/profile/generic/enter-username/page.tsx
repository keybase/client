import * as React from 'react'

const getOptions = () => ({gesturesEnabled: false})
const EnterUsername = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <EnterUsername />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
