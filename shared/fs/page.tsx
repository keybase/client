import * as React from 'react'
import * as T from '../constants/types'
import * as C from '../constants'
import * as Container from '../util/container'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'

const Index = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Index>

const getOptions = (ownProps?: OwnProps) => {
  const path = ownProps?.route.params?.path ?? C.defaultPath
  return Container.isMobile
    ? {header: () => <MobileHeader path={path} />}
    : {
        headerRightActions: () => <Actions path={path} onTriggerFilterMobile={() => {}} />,
        headerTitle: () => <Title path={path} />,
        subHeader: MainBanner,
        title: path === C.defaultPath ? 'Files' : T.FS.getPathName(path),
      }
}

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Index {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
