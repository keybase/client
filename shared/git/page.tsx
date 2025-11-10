import * as React from 'react'
import * as C from '@/constants'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const Index = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Index>

export default {
  getOptions: C.isMobile
    ? {title: 'Git'}
    : {
        headerRightActions: HeaderRightActions,
        headerTitle: HeaderTitle,
        title: 'Git',
      },
  screen: (p: OwnProps) => <Index {...p.route.params} />,
}
