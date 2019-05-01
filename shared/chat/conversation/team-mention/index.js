// @flow
import React from 'react'
import Text from '../../../common-adapters/text'
import {Box2} from '../../../common-adapters/box'
import * as Styles from '../../../styles'
import TeamInfo from '../../../profile/user/teams/teaminfo'

export type Props = {|
  allowFontScaling?: boolean,
  channel: string,
  description: string,
  inTeam: boolean,
  isOpen: boolean,
  name: string,
  onJoinTeam: string => void,
  resolved: boolean,
  numMembers: number,
  publicAdmins: Array<string>,
  style?: Styles.StylesCrossPlatform,
|}

type State = {
  showPopup: boolean,
}

class TeamMention extends React.Component<Props, State> {
  state = {showPopup: false}
  _mentionRef = React.createRef()
  _getAttachmentRef = () => {
    return this._mentionRef.current
  }
  _showPopup = () => {
    this.setState({showPopup: true})
  }
  _hidePopup = () => {
    this.setState({showPopup: false})
  }
  render() {
    let text = `@${this.props.name}`
    if (this.props.channel.length > 0) {
      text += `#${this.props.channel}`
    }
    const content = (
      <Text
        ref={this._mentionRef}
        type="BodySemibold"
        className={Styles.classNames({'hover-underline': !Styles.isMobile})}
        style={Styles.collapseStyles([this.props.style, styles.resolved, styles.text])}
        allowFontScaling={this.props.allowFontScaling}
        onClick={this._showPopup}
      >
        {text}
      </Text>
    )
    const popups = (
      <TeamInfo
        attachTo={this._getAttachmentRef}
        description={this.props.description}
        inTeam={this.props.inTeam}
        isOpen={this.props.isOpen}
        name={this.props.name}
        membersCount={this.props.numMembers}
        onHidden={this._hidePopup}
        onJoinTeam={this.props.onJoinTeam}
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
        <Box2
          direction="horizontal"
          style={styles.container}
          onMouseOver={this._showPopup}
          onMouseLeave={this._hidePopup}
        >
          {content}
          {popups}
        </Box2>
      )
    ) : (
      <Text type="Body" style={this.props.style} allowFontScaling={this.props.allowFontScaling}>
        {text}
      </Text>
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
