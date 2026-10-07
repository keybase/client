import * as React from 'react'
import * as C from '@/constants'
import {HeaderTitle, HeaderRightActions} from './nav-header'
import {defineRouteMap} from '@/constants/types/router'

export const newRoutes = defineRouteMap({
  gitRoot: C.makeScreen(
    React.lazy(async () => import('.')),
    {
      getOptions: isMobile
        ? {title: 'Git'}
        : () => {
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
  gitDeleteRepo: C.makeScreen(React.lazy(async () => import('./delete-repo')), {
    getOptions: {title: 'Delete repository'},
  }),
  gitNewRepo: C.makeScreen(React.lazy(async () => import('./new-repo')), {
    getOptions: ({route}) => ({
      title: route.params.isTeam ? 'New team repository' : 'New personal repository',
    }),
  }),
  gitSelectChannel: C.makeScreen(React.lazy(async () => import('./select-channel'))),
})
