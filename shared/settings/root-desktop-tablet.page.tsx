import * as React from 'react'
import * as Container from '../util/container'

const Root = React.lazy(async () => import('./root-desktop-tablet'))

const getOptions = Container.isMobile
  ? undefined
  : () => ({
      title: 'Settings',
    })

const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen, skipShim: true}
