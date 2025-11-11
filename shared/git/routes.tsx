import * as React from 'react'
import * as C from '@/constants'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const Index = React.lazy(async () => import('.'))
const gitRoot = {
  getOptions: C.isMobile
    ? {title: 'Git'}
    : {
        headerRightActions: HeaderRightActions,
        headerTitle: HeaderTitle,
        title: 'Git',
      },
  screen: function GitRoot(p: C.ViewPropsToPageProps<typeof Index>) {
    return <Index {...p.route.params} />
  },
}

const Delete = React.lazy(async () => import('./delete-repo'))
const gitDeleteRepo = {
  screen: function GitDeleteRepo(p: C.ViewPropsToPageProps<typeof Delete>) {
    return <Delete {...p.route.params} />
  },
}

const New = React.lazy(async () => import('./new-repo'))
const gitNewRepo = {
  screen: function GitNewRepo(p: C.ViewPropsToPageProps<typeof New>) {
    return <New {...p.route.params} />
  },
}

const Select = React.lazy(async () => import('./select-channel'))
const gitSelectChannel = {
  screen: function GitSelectChannel(p: C.ViewPropsToPageProps<typeof Select>) {
    return <Select {...p.route.params} />
  },
}

export const newRoutes = {gitRoot}
export const newModalRoutes = {
  gitDeleteRepo,
  gitNewRepo,
  gitSelectChannel,
}

export type RootParamListGit = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
