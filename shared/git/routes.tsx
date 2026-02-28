import * as React from 'react'
import * as C from '@/constants'
import type * as NavHeader from './nav-header'

export const newRoutes = {
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
}

export const newModalRoutes = {
  gitDeleteRepo: C.makeScreen(React.lazy(async () => import('./delete-repo'))),
  gitNewRepo: C.makeScreen(React.lazy(async () => import('./new-repo'))),
  gitSelectChannel: C.makeScreen(React.lazy(async () => import('./select-channel'))),
}

export type RootParamListGit = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
