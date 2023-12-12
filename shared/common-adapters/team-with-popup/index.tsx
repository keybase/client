import * as React from 'react'
import {Box2} from '@/common-adapters/box'
import * as Styles from '@/styles'
import Text, {type TextType} from '@/common-adapters/text'
import DelayedMounting from '../delayed-mounting'
import {TeamDetailsSubscriber} from '../../teams/subscriber'
import type TeamInfoType from '../../profile/user/teams/teaminfo'
import type * as T from '@/constants/types'
import type {MeasureRef} from 'common-adapters/measure-ref'

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
  teamID: T.Teams.TeamID
  teamName: string
  type: TextType
  underline?: boolean
}

export const TeamWithPopup = (props: Props) => {
  const {onJoinTeam, onViewTeam} = props
  const {description, isMember, isOpen, memberCount} = props
  const {prefix, teamName, type, inline} = props
  const popupRef = React.useRef<MeasureRef>(null)
  const [showPopup, setShowPopup] = React.useState(false)
  const onHidePopup = () => setShowPopup(false)
  const onShowPopup = () => setShowPopup(true)

  const {default: TeamInfo} = require('../../profile/user/teams/teaminfo') as {default: typeof TeamInfoType}

  const popup = showPopup && (
    <>
      <TeamDetailsSubscriber teamID={props.teamID} />
      <DelayedMounting delay={Styles.isMobile ? 0 : 500}>
        <TeamInfo
          attachTo={popupRef}
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
