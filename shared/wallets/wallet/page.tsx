import * as React from 'react'
import Header from './header/container'

const Index = React.lazy(async () => import('./container'))

const getOptions = () => ({
  header: () => <Header />,
  headerLeft: () => null,
  headerRight: () => null,
  headerTitle: () => null,
})

const Screen = () => (
  <React.Suspense>
    <Index />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
