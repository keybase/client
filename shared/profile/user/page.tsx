import * as React from 'react'
import * as Styles from '../../styles'
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
type OwnProps = {route: {params: {username: string}}}
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <ProfileLazy {...p.route.params} />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profile: {getOptions, getScreen}}
export type RouteProps = {profile: OwnProps['route']['params']}
