import * as React from 'react'

const Select = React.lazy(async () => import('./select-other-device'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Select />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
