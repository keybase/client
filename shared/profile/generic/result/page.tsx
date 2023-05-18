import * as React from 'react'

const EnterUsername = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <EnterUsername />
  </React.Suspense>
)
export default {getScreen: () => Screen}
