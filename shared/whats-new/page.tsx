import * as React from 'react'
import * as C from '@/constants'

const Screen = React.lazy(async () => import('./container'))

export default {
  getOptions: C.isMobile ? {title: 'Keybase FM 87.7'} : undefined,
  screen: Screen,
}
