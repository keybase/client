import * as React from 'react'

const Onboard = React.lazy(async () => {
  const {RoutedOnboarding} = await import('./container')
  return {default: RoutedOnboarding}
})

const Screen = () => (
  <React.Suspense>
    <Onboard />
  </React.Suspense>
)

export default {getScreen: () => Screen}
