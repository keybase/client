import * as React from 'react'
import {Box2} from '../box'
import * as Styles from '../../styles'
import Text, {type TextType} from '../text'
import TeamInfo from '../../profile/user/teams/teaminfo'
import DelayedMounting from '../delayed-mounting'
import type * as TeamsTypes from '../../constants/types/teams'
import {TeamDetailsSubscriber} from '../../teams/subscriber'

const Kb = {
  Box2,
  Text,
}
export type Props = {
  description: string
  isMember: boolean
  isOpen: boolean
  inline?: boolean
  memberCount: number
  onJoinTeam: () => void
  onViewTeam: () => void
  prefix?: string
  shouldLoadTeam?: boolean
  teamID: TeamsTypes.TeamID
  teamName: string
  type: TextType
  underline?: boolean
}

export const TeamWithPopup = (props: Props) => {
  const {onJoinTeam, onViewTeam} = props
  const {description, isMember, isOpen, memberCount} = props
  const {prefix, teamName, type, inline} = props
  const popupRef = React.useRef(null)
  const [showPopup, setShowPopup] = React.useState(false)

  const _getAttachmentRef = () => popupRef.current
  const onHidePopup = () => setShowPopup(false)
  const onShowPopup = () => setShowPopup(true)

  const popup = showPopup && (
    <>
      <TeamDetailsSubscriber teamID={props.teamID} />
      <DelayedMounting delay={Styles.isMobile ? 0 : 500}>
        <TeamInfo
          attachTo={_getAttachmentRef}
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
      <Kb.Text type={type} ref={popupRef}>
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
    } as const)
)
