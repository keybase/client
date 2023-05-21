import * as React from 'react'
import * as Container from '../util/container'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const Index = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Index>

const getOptions = () =>
  Container.isMobile
    ? {title: 'Devices'}
    : {
        headerRightActions: HeaderRightActions,
        headerTitle: HeaderTitle,
        title: 'Devices',
      }

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Index {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
