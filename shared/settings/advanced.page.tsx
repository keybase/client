import * as React from 'react'
import * as Container from '../util/container'

const Advanced = React.lazy(async () => import('./advanced'))

const getOptions = () =>
  Container.isMobile
    ? {
        header: undefined,
        title: 'Advanced',
      }
    : undefined

const Screen = () => (
  <React.Suspense>
    <Advanced />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
