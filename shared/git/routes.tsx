import * as React from 'react'
import * as C from '@/constants'
import type * as NavHeader from '@/git/nav-header'
import {defineRouteMap} from '@/constants/types/router'

export const newRoutes = defineRouteMap({
  gitRoot: C.makeScreen(
    React.lazy(async () => import('.')),
    {
      getOptions: C.isMobile
        ? {title: 'Git'}
        : () => {
            const {HeaderTitle, HeaderRightActions} = require('./nav-header') as typeof NavHeader
            return {
              headerRightActions: HeaderRightActions,
              headerTitle: HeaderTitle,
              title: 'Git',
            }
          },
    }
  ),
})

export const newModalRoutes = defineRouteMap({
  gitDeleteRepo: C.makeScreen(React.lazy(async () => import('@/git/delete-repo')), {
    getOptions: {title: 'Delete repo?'},
  }),
  gitNewRepo: C.makeScreen(React.lazy(async () => import('@/git/new-repo')), {
    getOptions: {title: 'New repository'},
  }),
  gitSelectChannel: C.makeScreen(React.lazy(async () => import('@/git/select-channel'))),
})
