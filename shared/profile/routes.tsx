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
        headerLeft: (p: {onPress?: () => void; tintColor: string}) => {
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
    React.lazy(async () => import('./add-to-team/container')),
    {
      getOptions: {
        modal2: true,
        modal2ClearCover: false,
        modal2Style: styles.modal2,
        modal2Type: 'DefaultFullHeight',
      },
    }
  ),
  profileConfirmOrPending: C.makeScreen(React.lazy(async () => import('./confirm-or-pending/container'))),
  profileEdit: C.makeScreen(React.lazy(async () => import('./edit-profile/container'))),
  profileEditAvatar: C.makeScreen(React.lazy(async () => import('./edit-avatar/container'))),
  profileFinished: C.makeScreen(React.lazy(async () => import('./pgp/finished'))),
  profileGenerate: C.makeScreen(React.lazy(async () => import('./pgp/generate'))),
  profileGenericEnterUsername: C.makeScreen(
    React.lazy(async () => import('./generic/enter-username/container')),
    {
      getOptions: {gesturesEnabled: false},
    }
  ),
  profileGenericProofResult: C.makeScreen(React.lazy(async () => import('./generic/result/container'))),
  profileImport: C.makeScreen(React.lazy(async () => import('./pgp/import'))),
  profilePgp: C.makeScreen(React.lazy(async () => import('./pgp/choice'))),
  profilePostProof: C.makeScreen(React.lazy(async () => import('./post-proof/container'))),
  profileProofsList: C.makeScreen(React.lazy(async () => import('./generic/proofs-list/container'))),
  profileProveEnterUsername: C.makeScreen(React.lazy(async () => import('./prove-enter-username/container'))),
  profileProveWebsiteChoice: C.makeScreen(React.lazy(async () => import('./prove-website-choice/container'))),
  profileProvideInfo: C.makeScreen(React.lazy(async () => import('./pgp/info'))),
  profileRevoke: C.makeScreen(React.lazy(async () => import('./revoke/container'))),
  profileShowcaseTeamOffer: C.makeScreen(React.lazy(async () => import('./showcase-team-offer'))),
}

export type RootParamListProfile = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
