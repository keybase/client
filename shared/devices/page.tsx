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

export default {getOptions, screen: React.lazy(async () => import('.'))}
