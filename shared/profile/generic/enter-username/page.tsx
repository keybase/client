import * as React from 'react'

const getOptions = () => ({gesturesEnabled: false})

const EnterUsername = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <EnterUsername />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileGenericEnterUsername: {getOptions, getScreen}}
