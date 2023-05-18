import * as React from 'react'

const PostProof = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <PostProof />
  </React.Suspense>
)
export default {getScreen: () => Screen}
