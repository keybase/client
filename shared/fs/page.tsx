import * as React from 'react'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'
import * as Container from '../util/container'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'

type OwnProps = {route: {params: {path: Types.Path}}}

const getOptions = (ownProps: OwnProps) => {
  const path = ownProps.route.params?.path ?? Constants.defaultPath
  return Container.isMobile
    ? {
        header: () => <MobileHeader path={path} />,
      }
    : {
        headerRightActions: () => <Actions path={path} onTriggerFilterMobile={() => {}} />,
        headerTitle: () => <Title path={path} />,
        subHeader: MainBanner,
        title: path === Constants.defaultPath ? 'Files' : Types.getPathName(path),
      }
}

const Index = React.lazy(async () => import('.'))
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Index {...p.route.params} />
  </React.Suspense>
)
const getScreen = () => Screen

export default {fsRoot: {getOptions, getScreen}}
export type RouteProps = {fsRoot: OwnProps['route']['params']}
