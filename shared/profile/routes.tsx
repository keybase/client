import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'

const Title = React.lazy(async () => import('./search'))

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      overlay: {width: Kb.Styles.isMobile ? undefined : 500},
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
              <HeaderLeftButton autoDetectCanGoBack={true} tintColor={p.tintColor} />
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
        modalStyle: {height: 560},
        overlayStyle: styles.overlay,
        overlayTransparent: false,
      },
    }
  ),
  profileConfirmOrPending: C.makeScreen(React.lazy(async () => import('./confirm-or-pending'))),
  profileEdit: C.makeScreen(React.lazy(async () => import('./edit-profile')), {
    getOptions: {modalStyle: {height: 450, width: 350}, title: 'Edit Profile'},
  }),
  profileEditAvatar: C.makeScreen(React.lazy(async () => import('./edit-avatar')), {
    getOptions: ({route}) => ({
      title: route.params.teamID ? '' : C.isIOS ? 'Zoom and pan' : 'Upload avatar',
    }),
  }),
  profileFinished: C.makeScreen(React.lazy(async () => import('./pgp/finished'))),
  profileGenerate: C.makeScreen(React.lazy(async () => import('./pgp/generate'))),
  profileGenericEnterUsername: C.makeScreen(React.lazy(async () => import('./generic/enter-username')), {
    getOptions: {gestureEnabled: false, modalStyle: {height: 485, width: 560}},
  }),
  profileGenericProofResult: C.makeScreen(React.lazy(async () => import('./generic/result')), {
    getOptions: {modalStyle: {height: 485, width: 560}},
  }),
  profileImport: C.makeScreen(React.lazy(async () => import('./pgp/import'))),
  profilePgp: C.makeScreen(React.lazy(async () => import('./pgp/choice'))),
  profilePostProof: C.makeScreen(React.lazy(async () => import('./post-proof'))),
  profileProofsList: C.makeScreen(React.lazy(async () => import('./generic/proofs-list')), {
    getOptions: {modalStyle: {height: 485, width: 560}, title: 'Prove your...'},
  }),
  profileProveEnterUsername: C.makeScreen(React.lazy(async () => import('./prove-enter-username'))),
  profileProveWebsiteChoice: C.makeScreen(React.lazy(async () => import('./prove-website-choice'))),
  profileProvideInfo: C.makeScreen(React.lazy(async () => import('./pgp/info'))),
  profileRevoke: C.makeScreen(React.lazy(async () => import('./revoke'))),
  profileShowcaseTeamOffer: C.makeScreen(React.lazy(async () => import('./showcase-team-offer')), {
    getOptions: {modalStyle: {maxHeight: 600, maxWidth: 600}, title: 'Feature your teams'},
  }),
}
