import * as React from 'react'

const Crypto = React.lazy(async () => import('.'))

const getOptions = () => ({
  title: 'Crypto',
})

const Screen = () => (
  <React.Suspense>
    <Crypto />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
