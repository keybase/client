import * as React from 'react'
import * as C from '@/constants'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const getOptions = C.isMobile
  ? {title: 'Git'}
  : {
      headerRightActions: HeaderRightActions,
      headerTitle: HeaderTitle,
      title: 'Git',
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
