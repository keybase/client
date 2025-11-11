import * as React from 'react'
import * as C from '@/constants'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const getOptions = C.isMobile
  ? {title: 'Devices'}
  : {
      headerRightActions: HeaderRightActions,
      headerTitle: HeaderTitle,
      title: 'Devices',
    }

const Screen = React.lazy(async () => import('.'))

export default {getOptions, screen: Screen}
