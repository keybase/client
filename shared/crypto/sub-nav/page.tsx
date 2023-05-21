import * as React from 'react'
import * as Container from '../../util/container'

const Crypto = React.lazy(async () => import('.'))

const getOptions = () => (Container.isMobile ? {title: 'Crypto'} : {title: 'Crypto tools'})

const Screen = () => (
  <React.Suspense>
    <Crypto />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen, skipShim: !Container.isMobile}
