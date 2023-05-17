import * as React from 'react'

const PostProof = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <PostProof />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profilePostProof: {getScreen}}
