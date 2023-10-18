import * as React from 'react'
import * as C from '../constants'

const WN = React.lazy(async () => import('./container'))

export const getOptions = () => (C.isMobile ? {title: 'Keybase FM 87.7'} : {})

const Screen = () => (
  <React.Suspense>
    <WN />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
