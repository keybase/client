import * as React from 'react'

const Index = React.lazy(async () => import('./wallets-sub-nav'))

const getOptions = () => ({
  header: () => null,
  headerTitle: '',
})

const Screen = () => (
  <React.Suspense>
    <Index />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen, skipShim: true}
