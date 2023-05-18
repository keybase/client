import * as React from 'react'

const Choice = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Choice />
  </React.Suspense>
)
export default {getScreen: () => Screen}
