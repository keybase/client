import * as React from 'react'
import * as C from '@/constants'

const Screen = React.lazy(async () => import('.'))

export default {
  getOptions: C.isMobile ? {title: 'Crypto'} : {title: 'Crypto tools'},
  screen: Screen,
}
