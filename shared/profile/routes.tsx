import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as C from '@/constants'
import {HeaderLeftArrowCanGoBack} from '@/common-adapters/header-hoc'

const Title = React.lazy(async () => import('./search'))
const Profile = React.lazy(async () => import('./user/container'))
const profile = {
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
  screen: function ProfileScreen(p: C.ViewPropsToPageProps<typeof Profile>) {
    return <Profile {...p.route.params} />
  },
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      modal2: {width: Kb.Styles.isMobile ? undefined : 500},
    }) as const
)

const AddToTeam = React.lazy(async () => import('./add-to-team/container'))
const profileAddToTeam = {
  getOptions: {
    modal2: true,
    modal2ClearCover: false,
    modal2Style: styles.modal2,
    modal2Type: 'DefaultFullHeight',
  },
  screen: function ProfileAddToTeam(p: C.ViewPropsToPageProps<typeof AddToTeam>) {
    return <AddToTeam {...p.route.params} />
  },
}

const ConfirmOrPending = React.lazy(async () => import('./confirm-or-pending/container'))
const profileConfirmOrPending = {
  screen: ConfirmOrPending,
}

const EditProfile = React.lazy(async () => import('./edit-profile/container'))
const profileEdit = {
  screen: EditProfile,
}

const EditAvatar = React.lazy(async () => import('./edit-avatar/container'))
const profileEditAvatar = {
  screen: function ProfileEditAvatar(p: C.ViewPropsToPageProps<typeof EditAvatar>) {
    return <EditAvatar {...p.route.params} />
  },
}

const GenericEnterUsername = React.lazy(async () => import('./generic/enter-username/container'))
const profileGenericEnterUsername = {
  getOptions: {gesturesEnabled: false},
  screen: GenericEnterUsername,
}

const GenericProofResult = React.lazy(async () => import('./generic/result/container'))
const profileGenericProofResult = {
  screen: GenericProofResult,
}

const PostProof = React.lazy(async () => import('./post-proof/container'))
const profilePostProof = {
  screen: PostProof,
}

const ProofsList = React.lazy(async () => import('./generic/proofs-list/container'))
const profileProofsList = {
  screen: ProofsList,
}

const ProveEnterUsername = React.lazy(async () => import('./prove-enter-username/container'))
const profileProveEnterUsername = {
  screen: ProveEnterUsername,
}

const ProveWebsiteChoice = React.lazy(async () => import('./prove-website-choice/container'))
const profileProveWebsiteChoice = {
  screen: ProveWebsiteChoice,
}

const Revoke = React.lazy(async () => import('./revoke/container'))
const profileRevoke = {
  screen: function ProfileRevoke(p: C.ViewPropsToPageProps<typeof Revoke>) {
    return <Revoke {...p.route.params} />
  },
}

const ShowcaseTeamOffer = React.lazy(async () => import('./showcase-team-offer'))
const profileShowcaseTeamOffer = {
  screen: ShowcaseTeamOffer,
}

const PgpFinished = React.lazy(async () => import('./pgp/finished'))
const profileFinished = {
  screen: PgpFinished,
}

const PgpGenerate = React.lazy(async () => import('./pgp/generate'))
const profileGenerate = {
  screen: PgpGenerate,
}

const PgpImport = React.lazy(async () => import('./pgp/import'))
const profileImport = {
  screen: PgpImport,
}

const PgpChoice = React.lazy(async () => import('./pgp/choice'))
const profilePgp = {
  screen: PgpChoice,
}

const PgpInfo = React.lazy(async () => import('./pgp/info'))
const profileProvideInfo = {
  screen: PgpInfo,
}

export const newRoutes = {
  profile,
}

export const newModalRoutes = {
  profileAddToTeam,
  profileConfirmOrPending,
  profileEdit,
  profileEditAvatar,
  profileFinished,
  profileGenerate,
  profileGenericEnterUsername,
  profileGenericProofResult,
  profileImport,
  profilePgp,
  profilePostProof,
  profileProofsList,
  profileProveEnterUsername,
  profileProveWebsiteChoice,
  profileProvideInfo,
  profileRevoke,
  profileShowcaseTeamOffer,
}

export type RootParamListProfile = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
