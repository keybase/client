import * as React from 'react'
import * as Styles from '../../styles'
import type * as Container from '../../util/container'
import {HeaderLeftArrow} from '../../common-adapters/header-hoc'

const LazyTitle = React.lazy(async () => import('../search/bar'))

const getOptions = () => ({
  headerLeft: (p: {canGoBack: boolean; onPress: () => void; tintColor: string}) => (
    <Styles.CanFixOverdrawContext.Provider value={false}>
      <HeaderLeftArrow canGoBack={p.canGoBack} onPress={p.onPress} tintColor={p.tintColor} />
    </Styles.CanFixOverdrawContext.Provider>
  ),
  headerShown: true,
  headerStyle: {backgroundColor: 'transparent'},
  headerTitle: () => (
    <React.Suspense>
      <LazyTitle />
    </React.Suspense>
  ),
  headerTransparent: true,
})

const ProfileLazy = React.lazy(async () => import('./container'))
const Screen = (p: Container.RouteProps2<'profile'>) => (
  <React.Suspense>
    <ProfileLazy username={p.route.params.username} />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profile: {getOptions, getScreen}}
