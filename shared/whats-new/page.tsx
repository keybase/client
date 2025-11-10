import * as React from 'react'
import * as C from '@/constants'

export default {
  getOptions: C.isMobile ? {title: 'Keybase FM 87.7'} : undefined,
  screen: React.lazy(async () => import('./container')),
}
