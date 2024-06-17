import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as C from '@/constants'
import {HeaderLeftArrow} from '@/common-adapters/header-hoc'

const Title = React.lazy(async () => import('../search/bar'))
const getOptions = {
  headerLeft: (p: {canGoBack: boolean; onPress: () => void; tintColor: string}) => (
    <Kb.Styles.CanFixOverdrawContext.Provider value={false}>
      <HeaderLeftArrow canGoBack={p.canGoBack} onPress={p.onPress} tintColor={p.tintColor} />
    </Kb.Styles.CanFixOverdrawContext.Provider>
  ),
  headerShown: true,
  headerStyle: {backgroundColor: 'transparent'},
  headerTitle: () => (
    <React.Suspense>
      <Title />
    </React.Suspense>
  ),
  headerTransparent: true,
}

const Profile = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Profile>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Profile {...p.route.params} />
  </React.Suspense>
)
const Page = {getOptions, getScreen: () => Screen}
export default Page
