import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import {ModalTitle} from '@/teams/common'
import {defineRouteMap} from '@/constants/types/router'
import {getNextRouteAfterAvatar} from '@/teams/new-team/wizard/state'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'

const Title = React.lazy(async () => import('./search'))

const EditAvatarHeaderLeft = ({wizard, showBack}: {wizard?: boolean; showBack?: boolean}) => {
  const navigateUp = C.Router2.navigateUp
  if (wizard || showBack) {
    return <Kb.Icon type="iconfont-arrow-left" onClick={navigateUp} />
  }
  return <HeaderLeftButton mode="cancel" />
}

const EditAvatarHeaderRight = ({
  parentTeamMemberCount,
  wizard,
  wizardState,
}: {
  parentTeamMemberCount: number
  wizard?: boolean
  wizardState?: T.Teams.NewTeamWizardState
}) => {
  const navigateAppend = C.Router2.navigateAppend
  const onSkip = () => {
    if (!wizardState) {
      return
    }
    navigateAppend(
      {
        name: 'profileEditAvatar',
        params: {createdTeam: true, newTeamWizard: wizardState, teamID: T.Teams.newTeamWizardTeamID, wizard},
      },
      true
    )
    navigateAppend(getNextRouteAfterAvatar(wizardState, parentTeamMemberCount))
  }
  if (!wizard) return null
  if (isMobile) {
    return <Kb.Text type="BodyBigLink" onClick={onSkip}>Skip</Kb.Text>
  }
  return <Kb.Button label="Skip" mode="Secondary" onClick={onSkip} style={skipButtonStyle} type="Default" />
}
const skipButtonStyle = {minWidth: 60}

const EditAvatarHeaderTitle = ({
  hasImage,
  newTeamWizard,
  teamID,
  wizard,
}: {
  hasImage?: boolean
  newTeamWizard?: T.Teams.NewTeamWizardState
  teamID?: string
  wizard?: boolean
}) => {
  if (teamID) {
    const title = hasImage && isIOS ? 'Zoom and pan' : wizard ? 'Upload avatar' : 'Change avatar'
    if (isMobile) {
      return <ModalTitle teamID={teamID} title={title} newTeamWizard={newTeamWizard} />
    }
    return <Kb.Text type="BodyBig">{title}</Kb.Text>
  }
  return <Kb.Text type="BodyBig">Upload an avatar</Kb.Text>
}

const EditAvatarWizardHeaderRight = ({
  route,
}: {
  route: {params: {newTeamWizard?: T.Teams.NewTeamWizardState; wizard?: boolean}}
}) => {
  const parentTeamID = route.params.newTeamWizard?.parentTeamID ?? T.Teams.noTeamID
  const {teamMeta} = useLoadedTeam(parentTeamID, parentTeamID !== T.Teams.noTeamID)
  return (
    <EditAvatarHeaderRight
      parentTeamMemberCount={teamMeta.memberCount}
      wizard={route.params.wizard}
      wizardState={route.params.newTeamWizard}
    />
  )
}

export const newRoutes = defineRouteMap({
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
})

export const newModalRoutes = defineRouteMap({
  profileAddToTeam: C.makeScreen(
    React.lazy(async () => import('./add-to-team')),
    {
      getOptions: {
        modalSize: 'wide',
        overlayTransparent: false,
      },
    }
  ),
  profileEdit: C.makeScreen(React.lazy(async () => import('./edit-profile')), {
    getOptions: {title: 'Edit Profile'},
  }),
  profileEditAvatar: C.makeScreen(React.lazy(async () => import('./edit-avatar')), {
    getOptions: ({route}) => ({
      headerLeft: () => (
        <EditAvatarHeaderLeft wizard={route.params.wizard} showBack={route.params.showBack} />
      ),
      headerRight: () => <EditAvatarWizardHeaderRight route={route} />,
      headerTitle: () => (
        <EditAvatarHeaderTitle
          hasImage={!!route.params.image}
          newTeamWizard={route.params.newTeamWizard}
          teamID={route.params.teamID}
          wizard={route.params.wizard}
        />
      ),
    }),
  }),
  profileImport: C.makeScreen(React.lazy(async () => import('./pgp/import')), {
    getOptions: Kb.doneModalOptions(''),
  }),
  profilePgp: C.makeScreen(React.lazy(async () => import('./pgp/choice')), {
    getOptions: {modalSize: 'wide'},
  }),
  profileProofsList: C.makeScreen(React.lazy(async () => import('./generic/proofs-list')), {
    getOptions: {modalSize: 'wide', title: 'Prove your...'},
  }),
  profileRevoke: C.makeScreen(React.lazy(async () => import('./revoke')), {
    getOptions: {modalSize: 'wide'},
  }),
  profileShowcaseTeamOffer: C.makeScreen(React.lazy(async () => import('./showcase-team-offer')), {
    getOptions: {modalSize: 'wide', title: 'Feature your teams'},
  }),
})
