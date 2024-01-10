import * as React from 'react'
import * as T from '@/constants/types'
import * as C from '@/constants'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'

const getOptions = (ownProps?: OwnProps) => {
  const path = ownProps?.route.params?.path ?? C.FS.defaultPath
  return C.isMobile
    ? {header: () => <MobileHeader path={path} />}
    : {
        headerRightActions: () => <Actions path={path} onTriggerFilterMobile={() => {}} />,
        headerTitle: () => <Title path={path} />,
        subHeader: MainBanner,
        title: path === C.FS.defaultPath ? 'Files' : T.FS.getPathName(path),
      }
}

const Index = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Index>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Index {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
