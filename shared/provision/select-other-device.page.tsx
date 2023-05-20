import * as React from 'react'

const Select = React.lazy(async () => import('./select-other-device'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = () => (
  <React.Suspense>
    <Select />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
