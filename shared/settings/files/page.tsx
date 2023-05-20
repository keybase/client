import * as React from 'react'
import * as Container from '../../util/container'

const Files = React.lazy(async () => import('./container'))

const getOptions = () =>
  Container.isMobile
    ? {
        header: undefined,
        title: 'Files',
      }
    : undefined

const Screen = () => (
  <React.Suspense>
    <Files />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
