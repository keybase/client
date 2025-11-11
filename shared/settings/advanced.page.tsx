import * as React from 'react'
import * as C from '@/constants'

const Screen = React.lazy(async () => import('./advanced'))

export default {
  getOptions: C.isMobile ? {title: 'Advanced'} : undefined,
  screen: Screen,
}
