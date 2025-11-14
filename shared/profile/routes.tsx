import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {HeaderLeftArrowCanGoBack} from '@/common-adapters/header-hoc'

const Title = React.lazy(async () => import('./search'))

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      modal2: {width: Kb.Styles.isMobile ? undefined : 500},
    }) as const
)

export const newRoutes = {
  profile: C.makeScreen(
    React.lazy(async () => import('./user/container')),
    {
      getOptions: {
        headerLeft: p => {
          return (
            <Kb.Styles.CanFixOverdrawContext.Provider value={false}>
              <HeaderLeftArrowCanGoBack onPress={p.onPress} tintColor={p.tintColor} />
            </Kb.Styles.CanFixOverdrawContext.Provider>
          )
        },
        headerShown: true,
        headerStyle: {backgroundColor: 'transparent'},
        headerTitle: () => (
          <React.Suspense>
            <Title />
          </React.Suspense>
        ),
        headerTransparent: true,
      },
    }
  ),
}

export const newModalRoutes = {
  profileAddToTeam: C.makeScreen(
    React.lazy(async () => import('./add-to-team')),
    {
      getOptions: {
        modal2: true,
        modal2ClearCover: false,
        modal2Style: styles.modal2,
        modal2Type: 'DefaultFullHeight',
      },
    }
  ),
  profileConfirmOrPending: {screen: React.lazy(async () => import('./confirm-or-pending'))},
  profileEdit: {screen: React.lazy(async () => import('./edit-profile'))},
  profileEditAvatar: C.makeScreen(React.lazy(async () => import('./edit-avatar'))),
  profileFinished: {screen: React.lazy(async () => import('./pgp/finished'))},
  profileGenerate: {screen: React.lazy(async () => import('./pgp/generate'))},
  profileGenericEnterUsername: {
    getOptions: {gesturesEnabled: false},
    screen: React.lazy(async () => import('./generic/enter-username')),
  },
  profileGenericProofResult: {screen: React.lazy(async () => import('./generic/result'))},
  profileImport: {screen: React.lazy(async () => import('./pgp/import'))},
  profilePgp: {screen: React.lazy(async () => import('./pgp/choice'))},
  profilePostProof: {screen: React.lazy(async () => import('./post-proof'))},
  profileProofsList: {screen: React.lazy(async () => import('./generic/proofs-list'))},
  profileProveEnterUsername: {screen: React.lazy(async () => import('./prove-enter-username'))},
  profileProveWebsiteChoice: {screen: React.lazy(async () => import('./prove-website-choice'))},
  profileProvideInfo: {screen: React.lazy(async () => import('./pgp/info'))},
  profileRevoke: C.makeScreen(React.lazy(async () => import('./revoke'))),
  profileShowcaseTeamOffer: {screen: React.lazy(async () => import('./showcase-team-offer'))},
}

export type RootParamListProfile = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
