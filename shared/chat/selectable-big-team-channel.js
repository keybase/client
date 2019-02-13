// @flow
import React, {PureComponent} from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {TeamAvatar} from './avatars'
import {isMobile} from '../constants/platform'

type Props = {|
  hasBadge: boolean,
  hasUnread: boolean,
  isSelected: boolean,
  teamname: string,
  channelname: string,
  onSelectConversation: () => void,
|}

type State = {|
  isHovered: boolean,
|}

class SelectableBigTeamChannel extends PureComponent<Props, State> {
  state = {
    isHovered: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})

  render() {
    const textStyle = Styles.collapseStyles([
      styles.text,
      this.props.isSelected && {color: Styles.globalColors.white},
      this.props.hasUnread && Styles.globalStyles.fontBold,
    ])
    return (
      <Kb.ClickableBox onClick={this.props.onSelectConversation}>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          gap="tiny"
          className="hover_background_color_blueGrey2"
          style={Styles.collapseStyles([
            styles.filteredRow,
            this.props.isSelected && {backgroundColor: Styles.globalColors.blue},
          ])}
          onMouseLeave={this._onMouseLeave}
          onMouseOver={this._onMouseOver}
        >
          <TeamAvatar
            teamname={this.props.teamname}
            isMuted={false}
            isSelected={false}
            isHovered={this.state.isHovered}
          />
          <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.flexOne}>
            <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.teamnameContainer}>
              <Kb.Box2 direction="horizontal" alignItems="center" style={styles.textInnerContainer}>
                <Kb.Text type="BodySemibold" title={this.props.teamname} lineClamp={1} style={textStyle}>
                  {this.props.teamname}
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.channelnameContainer}>
              <Kb.Box2 direction="horizontal" alignItems="center" style={styles.textInnerContainer}>
                <Kb.Text type="Body" title={`#${this.props.channelname}`} lineClamp={1} style={textStyle}>
                  #{this.props.channelname}
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
          </Kb.Box2>
          {this.props.hasBadge ? <Kb.Box style={styles.unreadDotStyle} /> : null}
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

export const rowHeight = isMobile ? 64 : 56

const textOuterContainer = {
  position: 'relative',
}
const styles = Styles.styleSheetCreate({
  channelnameContainer: {
    ...textOuterContainer,
    flex: 1.3, // let channelname expand a bit more
  },
  filteredRow: {
    height: rowHeight,
  },
  flexOne: {flex: 1},
  teamnameContainer: {
    ...textOuterContainer,
    flex: 1,
  },
  text: Styles.platformStyles({
    common: {paddingRight: Styles.globalMargins.tiny},
    isElectron: {display: 'inline'},
  }),
  textInnerContainer: {...Styles.globalStyles.fillAbsolute},
  unreadDotStyle: {
    backgroundColor: Styles.globalColors.orange,
    borderRadius: 6,
    flexShrink: 0,
    height: 8,
    marginRight: Styles.globalMargins.tiny,
    width: 8,
  },
})

export default SelectableBigTeamChannel
