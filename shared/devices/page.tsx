import * as React from 'react'
import * as Container from '../util/container'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const Index = React.lazy(async () => import('.'))

const getOptions = () =>
  Container.isMobile
    ? {title: 'Devices'}
    : {
        headerRightActions: HeaderRightActions,
        headerTitle: HeaderTitle,
        title: 'Devices',
      }

const Screen = () => (
  <React.Suspense>
    <Index />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
