import * as React from 'react'
import * as C from '../constants'

const Advanced = React.lazy(async () => import('./advanced'))

const getOptions = () =>
  C.isMobile
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
