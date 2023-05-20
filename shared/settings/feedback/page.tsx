import * as React from 'react'
import * as Container from '../../util/container'

const Feedback = React.lazy(async () => import('./container'))

const getOptions = () =>
  Container.isMobile
    ? {
        header: undefined,
        title: 'Feedback',
        useHeaderHeight: () => 60,
      }
    : {}

const Screen = () => (
  <React.Suspense>
    <Feedback />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
