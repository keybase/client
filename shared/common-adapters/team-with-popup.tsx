import * as C from '@/constants'
import * as React from 'react'
import {Box2} from './box'
import * as Styles from '@/styles'
import Text from './text'
import type {TextType} from './text.shared'
import DelayedMounting from './delayed-mounting'
import type TeamInfoType from '../profile/user/teams/teaminfo'
import * as T from '@/constants/types'
import type {MeasureRef} from './measure-ref'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'
import {useTeamsListNameToIDMap} from '@/teams/use-teams-list'

const Kb = {
  Box2,
  Text,
}
export type Props = {
  description: string
  isMember: boolean
  isOpen: boolean
  inline?: boolean | undefined
  memberCount: number
  onJoinTeam: () => void
  onPopupVisibleChange?: ((visible: boolean) => void) | undefined
  onViewTeam: () => void
  prefix?: string | undefined
  shouldLoadTeam?: boolean | undefined
  teamID: T.Teams.TeamID
  teamName: string
  type: TextType
  underline?: boolean | undefined
}

const TeamWithPopup = (props: Props) => {
  const {onJoinTeam, onViewTeam} = props
  const {description, isMember, isOpen, memberCount} = props
  const {prefix, teamName, type, inline} = props
  const popupRef = React.useRef<MeasureRef | null>(null)
  const [showPopup, setShowPopup] = React.useState(false)
  const onHidePopup = () => {
    props.onPopupVisibleChange?.(false)
    setShowPopup(false)
  }
  const onShowPopup = () => {
    props.onPopupVisibleChange?.(true)
    setShowPopup(true)
  }

  const {default: TeamInfo} = require('../profile/user/teams/teaminfo') as {default: typeof TeamInfoType}

  const popup = showPopup && (
    <>
      <DelayedMounting delay={Styles.isMobile ? 0 : 500}>
        <TeamInfo
          attachTo={Styles.isMobile ? undefined : popupRef}
          description={description}
          inTeam={isMember}
          isOpen={isOpen}
          name={teamName}
          membersCount={memberCount}
          onHidden={onHidePopup}
          onJoinTeam={onJoinTeam}
          onViewTeam={onViewTeam}
          publicAdmins={[]}
          visible={showPopup}
        />
      </DelayedMounting>
    </>
  )
  return (
    <Kb.Box2
      direction="horizontal"
      onMouseOver={onShowPopup}
      onMouseLeave={onHidePopup}
      style={inline && styles.inlineStyle}
    >
      <Kb.Text type={type} textRef={popupRef}>
        <Kb.Text type={type}>{prefix}</Kb.Text>
        <Kb.Text type={type} className={Styles.classNames({'hover-underline': props.underline ?? true})}>
          {teamName}
        </Kb.Text>
      </Kb.Text>
      {popup}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      inlineStyle: Styles.platformStyles({
        isElectron: {
          display: 'inline',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
    }) as const
)

type OwnProps = {
  inline?: boolean | undefined
  prefix?: string | undefined
  shouldLoadTeam?: boolean | undefined
  teamName: string
  type: TextType
  underline?: boolean | undefined
}

const ConnectedTeamWithPopup = (ownProps: OwnProps) => {
  const [showPopup, setShowPopup] = React.useState(false)
  const teamNameToID = useTeamsListNameToIDMap()
  const teamID = teamNameToID.get(ownProps.teamName) ?? T.Teams.noTeamID
  const {teamDetails, teamMeta} = useLoadedTeam(teamID, showPopup || !!ownProps.shouldLoadTeam)
  const stateProps = {
    description: teamDetails.description,
    isMember: teamMeta.isMember,
    isOpen: teamMeta.isOpen,
    memberCount: teamMeta.memberCount,
    teamID,
  }
  const clearModals = C.Router2.clearModals
  const navigateAppend = C.Router2.navigateAppend
  const _onViewTeam = (teamID: T.Teams.TeamID) => {
    clearModals()
    navigateAppend({name: 'team', params: {teamID}})
  }

  const props = {
    description: stateProps.description,
    inline: ownProps.inline,
    isMember: stateProps.isMember,
    isOpen: stateProps.isOpen,
    memberCount: stateProps.memberCount,
    onJoinTeam: () => navigateAppend({name: 'teamJoinTeamDialog', params: {initialTeamname: ownProps.teamName}}),
    onPopupVisibleChange: setShowPopup,
    onViewTeam: () => {
      if (stateProps.teamID !== T.Teams.noTeamID) {
        _onViewTeam(stateProps.teamID)
      }
    },
    prefix: ownProps.prefix,
    shouldLoadTeam: ownProps.shouldLoadTeam,
    teamID: stateProps.teamID,
    teamName: ownProps.teamName,
    type: ownProps.type,
    underline: ownProps.underline,
  }
  return <TeamWithPopup {...props} />
}

export default ConnectedTeamWithPopup
