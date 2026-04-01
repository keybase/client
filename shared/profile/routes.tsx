import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as Teams from '@/stores/teams'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import {ModalTitle} from '@/teams/common'
import {useModalHeaderState} from '@/stores/modal-header'

const Title = React.lazy(async () => import('./search'))

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      overlay: {width: Kb.Styles.isMobile ? undefined : 500},
    }) as const
)

const profileModalStyle = {width: 560}

const EditAvatarHeaderLeft = ({wizard, showBack}: {wizard?: boolean; showBack?: boolean}) => {
  const navigateUp = C.Router2.navigateUp
  if (wizard || showBack) {
    return <Kb.Icon type="iconfont-arrow-left" onClick={navigateUp} />
  }
  return <HeaderLeftButton mode="cancel" />
}

const EditAvatarHeaderRight = ({wizard}: {wizard?: boolean}) => {
  const setTeamWizardAvatar = Teams.useTeamsState(s => s.dispatch.setTeamWizardAvatar)
  const onSkip = () => setTeamWizardAvatar()
  if (!wizard) return null
  if (Kb.Styles.isMobile) {
    return <Kb.Text type="BodyBigLink" onClick={onSkip}>Skip</Kb.Text>
  }
  return <Kb.Button label="Skip" mode="Secondary" onClick={onSkip} style={skipButtonStyle} type="Default" />
}
const skipButtonStyle = {minWidth: 60}

const EditAvatarHeaderTitle = ({teamID, wizard}: {teamID?: string; wizard?: boolean}) => {
  const hasImage = useModalHeaderState(s => s.editAvatarHasImage)
  if (teamID) {
    const title = hasImage && C.isIOS ? 'Zoom and pan' : wizard ? 'Upload avatar' : 'Change avatar'
    if (Kb.Styles.isMobile) {
      return <ModalTitle teamID={teamID} title={title} />
    }
    return <Kb.Text type="BodyBig">{title}</Kb.Text>
  }
  return <Kb.Text type="BodyBig">Upload an avatar</Kb.Text>
}

export const newRoutes = {
  profile: C.makeScreen(
    React.lazy(async () => import('./user')),
    {
      getOptions: {
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
  profileEdit: C.makeScreen(React.lazy(async () => import('./edit-profile')), {
    getOptions: {modalStyle: {height: 450, width: 350}, title: 'Edit Profile'},
  }),
  profileEditAvatar: C.makeScreen(React.lazy(async () => import('./edit-avatar')), {
    getOptions: ({route}) => ({
      headerLeft: () => (
        <EditAvatarHeaderLeft wizard={route.params?.wizard} showBack={route.params?.showBack} />
      ),
      headerRight: () => <EditAvatarHeaderRight wizard={route.params?.wizard} />,
      headerTitle: () => (
        <EditAvatarHeaderTitle teamID={route.params?.teamID} wizard={route.params?.wizard} />
      ),
    }),
  }),
  profileImport: C.makeScreen(React.lazy(async () => import('./pgp/import'))),
  profilePgp: C.makeScreen(React.lazy(async () => import('./pgp/choice')), {
    getOptions: {modalStyle: {height: 485, width: 560}},
  }),
  profileProofsList: C.makeScreen(React.lazy(async () => import('./generic/proofs-list')), {
    getOptions: {modalStyle: {height: 485, width: 560}, title: 'Prove your...'},
  }),
  profileProveWebsiteChoice: C.makeScreen(React.lazy(async () => import('./prove-website-choice')), {
    getOptions: {modalStyle: profileModalStyle},
  }),
  profileRevoke: C.makeScreen(React.lazy(async () => import('./revoke')), {
    getOptions: {modalStyle: profileModalStyle},
  }),
  profileShowcaseTeamOffer: C.makeScreen(React.lazy(async () => import('./showcase-team-offer')), {
    getOptions: {modalStyle: {maxHeight: 600, maxWidth: 600}, title: 'Feature your teams'},
  }),
}
