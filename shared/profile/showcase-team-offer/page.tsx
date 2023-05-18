import * as React from 'react'

const ShowCase = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <ShowCase />
  </React.Suspense>
)
export default {getScreen: () => Screen}
