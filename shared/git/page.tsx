import * as React from 'react'
import * as C from '../constants'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const Index = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Index>

const getOptions = () => {
  return C.isMobile
    ? {title: 'Git'}
    : {
        headerRightActions: HeaderRightActions,
        headerTitle: HeaderTitle,
        title: 'Git',
      }
}

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Index {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
