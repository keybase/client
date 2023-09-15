import * as React from 'react'
import * as C from '../constants'

const WN = React.lazy(async () => import('./container'))

export const getOptions = () =>
  C.isMobile
    ? {
        HeaderTitle: 'Keybase FM 87.7',
        header: undefined,
        title: 'Keybase FM 87.7',
      }
    : {}

const Screen = () => (
  <React.Suspense>
    <WN />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
