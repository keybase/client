import * as React from 'react'
import * as Container from '../util/container'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const Index = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Index>

const getOptions = () => {
  return Container.isMobile
    ? {
        title: 'Git',
      }
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
