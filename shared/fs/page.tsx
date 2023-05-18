import * as React from 'react'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'
import * as Container from '../util/container'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'

const Index = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Index>

const getOptions = (ownProps?: OwnProps) => {
  const path = ownProps?.route.params?.path ?? Constants.defaultPath
  return Container.isMobile
    ? {header: () => <MobileHeader path={path} />}
    : {
        headerRightActions: () => <Actions path={path} onTriggerFilterMobile={() => {}} />,
        headerTitle: () => <Title path={path} />,
        subHeader: MainBanner,
        title: path === Constants.defaultPath ? 'Files' : Types.getPathName(path),
      }
}

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Index {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
