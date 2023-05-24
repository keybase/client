import * as React from 'react'
import * as Container from '../util/container'

const Root = React.lazy(async () => import('./screenprotector.native'))

const getOptions = () => ({
  header: undefined,
  title: 'Screen Protector',
})

const Screen = () =>
  Container.isMobile ? (
    <React.Suspense>
      <Root />
    </React.Suspense>
  ) : null

export default {getOptions, getScreen: () => Screen}
