import * as React from 'react'
import Text, {type StylesTextCrossPlatform} from '@/common-adapters/text'
import {Box2} from '@/common-adapters/box'
import * as Styles from '@/styles'
import TeamInfo from '@/profile/user/teams/teaminfo'
import type {MeasureRef} from 'common-adapters/measure-ref'

const Kb = {Box2, Styles, Text}

export type Props = {
  allowFontScaling?: boolean
  channel: string
  description: string
  inTeam: boolean
  isOpen: boolean
  name: string
  numMembers: number
  onChat?: () => void
  onJoinTeam: (t: string) => void
  onViewTeam: () => void
  publicAdmins: ReadonlyArray<string>
  resolved: boolean
  style?: StylesTextCrossPlatform
}

const TeamMention = (props: Props) => {
  const [showPopup, setShowPopup] = React.useState(false)
  const mentionRef = React.useRef<MeasureRef | null>(null)

  const handleClick = () => {
    if (props.onChat) {
      props.onChat()
    } else {
      setShowPopup(true)
    }
  }

  const handleMouseOver = () => setShowPopup(true)
  const handleMouseLeave = () => setShowPopup(false)

  let text = `@${props.name}`
  if (props.channel.length > 0) {
    text += `#${props.channel}`
  }

  const content = (
    <Kb.Text
      textRef={mentionRef}
      type="BodyBold"
      className={Kb.Styles.classNames({'hover-underline': !Styles.isMobile})}
      style={Kb.Styles.collapseStyles([props.style, styles.text])}
      allowFontScaling={props.allowFontScaling}
      onClick={handleClick}
    >
      <Kb.Text
        type="BodyBold"
        style={Kb.Styles.collapseStyles([props.style, styles.resolved, styles.text])}
        allowFontScaling={props.allowFontScaling}
      >
        {text}
      </Kb.Text>
    </Kb.Text>
  )

  const popups = (
    <TeamInfo
      attachTo={mentionRef}
      description={props.description}
      inTeam={props.inTeam}
      isOpen={props.isOpen}
      name={props.name}
      membersCount={props.numMembers}
      onChat={props.onChat}
      onHidden={handleMouseLeave}
      onJoinTeam={props.onJoinTeam}
      onViewTeam={props.onViewTeam}
      publicAdmins={props.publicAdmins}
      visible={showPopup}
    />
  )

  return props.resolved ? (
    Kb.Styles.isMobile ? (
      <>
        {content}
        {popups}
      </>
    ) : (
      <Kb.Box2
        direction="horizontal"
        style={styles.container}
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
      >
        {content}
        {popups}
      </Kb.Box2>
    )
  ) : (
    <Kb.Text type="BodySemibold" style={props.style} allowFontScaling={props.allowFontScaling}>
      {text}
    </Kb.Text>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
        },
      }),
      resolved: {
        backgroundColor: Kb.Styles.globalColors.blue,
        borderRadius: 2,
        color: Kb.Styles.globalColors.white,
      },
      text: Kb.Styles.platformStyles({
        common: {
          letterSpacing: 0.3,
          paddingLeft: 2,
          paddingRight: 2,
        },
        isElectron: {
          display: 'inline-block',
        },
      }),
    }) as const
)

export default TeamMention
