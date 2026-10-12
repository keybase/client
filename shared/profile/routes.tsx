import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {HeaderLeftButton, type HeaderBackButtonProps} from '@/common-adapters/header-buttons'
import {ModalTitle} from '@/teams/common'
import {defineRouteMap} from '@/constants/types/router'
import {getNextRouteAfterAvatar} from '@/teams/new-team/wizard/state'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'

const Title = React.lazy(async () => import('./search'))

// Desktop closes with the X, so its left slot only ever holds Back.
const EditAvatarHeaderLeft = (p: HeaderBackButtonProps & {wizard?: boolean; showBack?: boolean}) => {
  const {wizard, showBack, ...rest} = p
  if (wizard || showBack) {
    return <HeaderLeftButton {...rest} />
  }
  return isMobile ? <HeaderLeftButton mode="cancel" /> : null
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
    return <ModalTitle teamID={teamID} title={title} newTeamWizard={newTeamWizard} />
  }
  return <Kb.ModalHeaderTitle title="Upload an avatar" />
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
      getOptions: ({route}) => ({modalSize: 'medium', title: `Add ${route.params.username} to...`}),
    }
  ),
  profileEdit: C.makeScreen(React.lazy(async () => import('./edit-profile')), {
    getOptions: {title: 'Edit Profile'},
  }),
  profileEditAvatar: C.makeScreen(React.lazy(async () => import('./edit-avatar')), {
    getOptions: ({route}) => ({
      ...(isIOS
        ? {
            unstable_headerLeftItems: () =>
              route.params.wizard || route.params.showBack
                ? [Kb.nativeBackHeaderItem()]
                : [Kb.nativeCancelHeaderItem()],
          }
        : {
            headerLeft: (p: HeaderBackButtonProps) => (
              <EditAvatarHeaderLeft {...p} wizard={route.params.wizard} showBack={route.params.showBack} />
            ),
          }),
      // Only register a right item when the Skip button actually renders: on iOS 26 a
      // custom header view that renders nothing still draws an empty glass pill.
      ...(route.params.wizard
        ? {headerRight: () => <EditAvatarWizardHeaderRight route={route} />}
        : {}),
      headerTitle: () => (
        <EditAvatarHeaderTitle
          hasImage={!!route.params.image}
          newTeamWizard={route.params.newTeamWizard}
          teamID={route.params.teamID}
          wizard={route.params.wizard}
        />
      ),
      modalSize: 'medium',
    }),
  }),
  profileImport: C.makeScreen(React.lazy(async () => import('./pgp/import')), {
    getOptions: Kb.doneModalOptions('Import a PGP key'),
  }),
  profilePgp: C.makeScreen(React.lazy(async () => import('./pgp/choice')), {
    getOptions: {title: 'Add a PGP key'},
  }),
  profileProofsList: C.makeScreen(React.lazy(async () => import('./generic/proofs-list')), {
    getOptions: {modalSize: 'medium', title: 'Prove your...'},
  }),
  profileRevoke: C.makeScreen(React.lazy(async () => import('./revoke')), {
    getOptions: ({route}) => ({title: route.params.platform === 'pgp' ? 'Drop PGP key' : 'Revoke proof'}),
  }),
  profileShowcaseTeamOffer: C.makeScreen(React.lazy(async () => import('./showcase-team-offer')), {
    getOptions: {...Kb.doneModalOptions('Feature your teams'), modalSize: 'medium'},
  }),
})
