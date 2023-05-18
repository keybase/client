import * as React from 'react'
import * as Styles from '../../styles'
import type * as Container from '../../util/container'
import {HeaderLeftArrow} from '../../common-adapters/header-hoc'

const Title = React.lazy(async () => import('../search/bar'))
const Profile = React.lazy(async () => import('./container'))

type OwnProps = Container.ViewPropsToPageProps<typeof Profile>

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
      <Title />
    </React.Suspense>
  ),
  headerTransparent: true,
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Profile {...p.route.params} />
  </React.Suspense>
)
export default {getOptions, getScreen: () => Screen}
