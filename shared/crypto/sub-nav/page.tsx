import * as React from 'react'
import * as C from '@/constants'

export default {
  getOptions: C.isMobile ? {title: 'Crypto'} : {title: 'Crypto tools'},
  screen: React.lazy(async () => import('.')),
}
