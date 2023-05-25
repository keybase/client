import * as React from 'react'

const CreateChan = React.lazy(async () => import('./create-channels'))

const Screen = () => (
  <React.Suspense>
    <CreateChan />
  </React.Suspense>
)

export default {getScreen: () => Screen}
