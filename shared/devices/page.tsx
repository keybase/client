import * as React from 'react'
import * as C from '@/constants'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const getOptions = C.isMobile
  ? {title: 'Devices'}
  : {
      headerRightActions: HeaderRightActions,
      headerTitle: HeaderTitle,
      title: 'Devices',
    }

const Index = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Index />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
