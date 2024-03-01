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

type State = {
  showPopup: boolean
}

class TeamMention extends React.Component<Props, State> {
  state = {showPopup: false}
  _mentionRef = React.createRef<MeasureRef>()

  _onClick = () => {
    if (this.props.onChat) {
      this.props.onChat()
    } else {
      this.setState({showPopup: true})
    }
  }
  _onMouseOver = () => {
    this.setState({showPopup: true})
  }
  _onMouseLeave = () => {
    this.setState({showPopup: false})
  }
  render() {
    let text = `@${this.props.name}`
    if (this.props.channel.length > 0) {
      text += `#${this.props.channel}`
    }

    const content = (
      <Kb.Text
        textRef={this._mentionRef as React.MutableRefObject<MeasureRef>}
        type="BodyBold"
        className={Kb.Styles.classNames({'hover-underline': !Styles.isMobile})}
        style={Kb.Styles.collapseStyles([this.props.style, styles.text])}
        allowFontScaling={this.props.allowFontScaling}
        onClick={this._onClick}
      >
        <Kb.Text
          type="BodyBold"
          style={Kb.Styles.collapseStyles([this.props.style, styles.resolved, styles.text])}
          allowFontScaling={this.props.allowFontScaling}
        >
          {text}
        </Kb.Text>
      </Kb.Text>
    )
    const popups = (
      <TeamInfo
        attachTo={this._mentionRef}
        description={this.props.description}
        inTeam={this.props.inTeam}
        isOpen={this.props.isOpen}
        name={this.props.name}
        membersCount={this.props.numMembers}
        onChat={this.props.onChat}
        onHidden={this._onMouseLeave}
        onJoinTeam={this.props.onJoinTeam}
        onViewTeam={this.props.onViewTeam}
        publicAdmins={this.props.publicAdmins}
        visible={this.state.showPopup}
      />
    )
    return this.props.resolved ? (
      Kb.Styles.isMobile ? (
        <>
          {content}
          {popups}
        </>
      ) : (
        <Kb.Box2
          direction="horizontal"
          style={styles.container}
          onMouseOver={this._onMouseOver}
          onMouseLeave={this._onMouseLeave}
        >
          {content}
          {popups}
        </Kb.Box2>
      )
    ) : (
      <Kb.Text type="BodySemibold" style={this.props.style} allowFontScaling={this.props.allowFontScaling}>
        {text}
      </Kb.Text>
    )
  }
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
