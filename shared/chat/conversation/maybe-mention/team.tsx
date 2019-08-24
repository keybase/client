import React from 'react'
import Text, {StylesTextCrossPlatform} from '../../../common-adapters/text'
import {Box2} from '../../../common-adapters/box'
import * as Styles from '../../../styles'
import TeamInfo from '../../../profile/user/teams/teaminfo'

const Kb = {Box2, Text}

export type Props = {
  allowFontScaling?: boolean
  channel: string
  description: string
  inTeam: boolean
  isOpen: boolean
  name: string
  onChat?: () => void
  onJoinTeam: (arg0: string) => void
  onViewTeam: (arg0: string) => void
  resolved: boolean
  numMembers: number
  publicAdmins: Array<string>
  style?: StylesTextCrossPlatform
}

type State = {
  showPopup: boolean
}

class TeamMention extends React.Component<Props, State> {
  state = {showPopup: false}
  _mentionRef = React.createRef<Text>()
  _getAttachmentRef = () => {
    return this._mentionRef.current
  }

  _onClick = () => {
    if (!Styles.isMobile && this.props.onChat) {
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
        ref={this._mentionRef}
        type="BodySemibold"
        className={Styles.classNames({'hover-underline': !Styles.isMobile})}
        style={Styles.collapseStyles([this.props.style, styles.resolved, styles.text])}
        allowFontScaling={this.props.allowFontScaling}
        onClick={this._onClick}
      >
        {Styles.isMobile && ' '}
        {text}
        {Styles.isMobile && ' '}
      </Kb.Text>
    )
    const popups = (
      <TeamInfo
        attachTo={this._getAttachmentRef}
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
      Styles.isMobile ? (
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
      <Kb.Text type="Body" style={this.props.style} allowFontScaling={this.props.allowFontScaling}>
        {text}
      </Kb.Text>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      display: 'inline-block',
    },
  }),
  resolved: {
    backgroundColor: Styles.globalColors.blue,
    borderRadius: 2,
    color: Styles.globalColors.white,
  },
  text: Styles.platformStyles({
    common: {
      letterSpacing: 0.3,
      paddingLeft: 2,
      paddingRight: 2,
    },
    isElectron: {
      display: 'inline-block',
    },
  }),
})

export default TeamMention
