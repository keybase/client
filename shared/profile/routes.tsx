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
    React.lazy(async () => import('./user')),
    {
      getOptions: {
        headerLeft: p => {
          return (
            <Kb.Styles.CanFixOverdrawContext.Provider value={false}>
              <HeaderLeftArrowCanGoBack tintColor={p.tintColor} />
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
        modal2ClearCover: false,
        modal2Style: styles.modal2,
      },
    }
  ),
  profileConfirmOrPending: C.makeScreen(React.lazy(async () => import('./confirm-or-pending'))),
  profileEdit: C.makeScreen(React.lazy(async () => import('./edit-profile'))),
  profileEditAvatar: C.makeScreen(React.lazy(async () => import('./edit-avatar'))),
  profileFinished: C.makeScreen(React.lazy(async () => import('./pgp/finished'))),
  profileGenerate: C.makeScreen(React.lazy(async () => import('./pgp/generate'))),
  profileGenericEnterUsername: C.makeScreen(React.lazy(async () => import('./generic/enter-username')), {
    getOptions: {gestureEnabled: false},
  }),
  profileGenericProofResult: C.makeScreen(React.lazy(async () => import('./generic/result'))),
  profileImport: C.makeScreen(React.lazy(async () => import('./pgp/import'))),
  profilePgp: C.makeScreen(React.lazy(async () => import('./pgp/choice'))),
  profilePostProof: C.makeScreen(React.lazy(async () => import('./post-proof'))),
  profileProofsList: C.makeScreen(React.lazy(async () => import('./generic/proofs-list'))),
  profileProveEnterUsername: C.makeScreen(React.lazy(async () => import('./prove-enter-username'))),
  profileProveWebsiteChoice: C.makeScreen(React.lazy(async () => import('./prove-website-choice'))),
  profileProvideInfo: C.makeScreen(React.lazy(async () => import('./pgp/info'))),
  profileRevoke: C.makeScreen(React.lazy(async () => import('./revoke'))),
  profileShowcaseTeamOffer: C.makeScreen(React.lazy(async () => import('./showcase-team-offer'))),
}
