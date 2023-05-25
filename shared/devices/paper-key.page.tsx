import * as React from 'react'

const Paperkey = React.lazy(async () => import('./paper-key'))

const getOptions = {
  gesturesEnabled: false,
  modal2: true,
  modal2NoClose: true,
}

const Screen = () => (
  <React.Suspense>
    <Paperkey />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
