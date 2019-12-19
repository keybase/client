import * as React from 'react'
import {Box2} from '../box'
import Text from '../text'
import * as Styles from '../../styles'
import {TextType} from '../text'
import TeamInfo from '../../profile/user/teams/teaminfo'
import DelayedMounting from '../delayed-mounting'

const Kb = {
  Box2,
  Text,
}
export type Props = {
  description: string
  isMember: boolean
  isOpen: boolean
  inline?: boolean
  loadTeam: () => void
  memberCount: number
  onJoinTeam: () => void
  onViewTeam: () => void
  prefix?: string
  teamName: string
  type: TextType
  underline?: boolean
}

export const TeamWithPopup = (props: Props) => {
  const {loadTeam, onJoinTeam, onViewTeam} = props
  const {description, isMember, isOpen, memberCount} = props
  const {prefix, teamName, type, inline} = props
  const popupRef = React.useRef(null)
  const [showPopup, setShowPopup] = React.useState(false)
  // load team details once on mount
  React.useEffect(() => {
    loadTeam()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const _getAttachmentRef = () => popupRef.current
  const onHidePopup = () => setShowPopup(false)
  const onShowPopup = () => setShowPopup(true)

  const popup = showPopup && (
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
