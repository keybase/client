// @flow
import React from 'react'
import Text from '../../../common-adapters/text'
import * as Styles from '../../../styles'
import TeamInfo from '../../../profile/user/teams/teaminfo'

export type Props = {|
  allowFontScaling?: boolean,
  channel: string,
  description?: string,
  isOpen: boolean,
  name: string,
  resolved: boolean,
  numMembers?: number,
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
    return this.props.resolved ? (
      <>
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
        <TeamInfo
          attachTo={this._getAttachmentRef}
          description={this.props.description}
          isOpen={this.props.isOpen}
          name={this.props.name}
          membersCount={this.props.numMembers}
          onHidden={this._hidePopup}
          publicAdmins={this.props.publicAdmins}
          visible={this.state.showPopup}
        />
      </>
    ) : (
      <Text type="Body" style={this.props.style} allowFontScaling={this.props.allowFontScaling}>
        {text}
      </Text>
    )
  }
}

const styles = Styles.styleSheetCreate({
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
