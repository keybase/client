import * as React from 'react'
import * as C from '@/constants'

export default {
  getOptions: C.isMobile ? {title: 'Files'} : undefined,
  screen: React.lazy(async () => import('./container')),
}
