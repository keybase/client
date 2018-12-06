// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import shallowEqual from 'shallowequal'
import TeamMenu from '../../../conversation/info-panel/menu/container'

type Props = {
  channelname?: string,
  teamname?: string,
  hasUnread: boolean,
  iconHoverColor: string,
  participants: Array<string>,
  showBold: boolean,
  showGear: boolean,
  backgroundColor: ?string,
  subColor: string,
  timestamp: ?string,
  usernameColor: ?string,
  hasBadge: boolean,
} & Kb.OverlayParentProps

class _SimpleTopLine extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (key === 'participants') {
        return shallowEqual(this.props.participants, nextProps.participants)
      }

      return undefined
    })
  }

  render() {
    const boldStyle = this.props.showBold ? styles.bold : null
    return (
      <Kb.Box style={styles.container}>
        {this.props.showGear && (
          <TeamMenu
            visible={this.props.showingMenu}
            attachTo={this.props.getAttachmentRef}
            onHidden={this.props.toggleShowingMenu}
            isSmallTeam={true}
            teamname={(this.props.participants.length && this.props.participants[0]) || ''}
          />
        )}
        <Kb.Box style={styles.insideContainer}>
          <Kb.Box style={styles.nameContainer}>
            {this.props.teamname && this.props.channelname ? (
              <Kb.Box2 direction="horizontal" fullWidth={true}>
                <Kb.Text
                  type="BodySemibold"
                  style={Styles.collapseStyles([
                    styles.teamTextStyle,
                    boldStyle,
                    {color: this.props.usernameColor},
                  ])}
                >
                  {this.props.teamname + '#' + this.props.channelname}
                </Kb.Text>
              </Kb.Box2>
            ) : (
              <Kb.PlaintextUsernames
                type="BodySemibold"
                containerStyle={Styles.collapseStyles([
                  styles.name,
                  boldStyle,
                  Styles.isMobile
                    ? {backgroundColor: this.props.backgroundColor, color: this.props.usernameColor}
                    : {color: this.props.usernameColor},
                ])}
                users={this.props.participants.map(p => ({username: p}))}
                title={this.props.participants.join(', ')}
              />
            )}
          </Kb.Box>
        </Kb.Box>
        <Kb.Text
          key="timestamp"
          type="BodySmall"
          className={Styles.classNames({'small-team-timestamp': this.props.showGear})}
          style={Styles.collapseStyles([
            boldStyle,
            styles.timestamp,
            !this.props.hasBadge && {color: this.props.subColor},
          ])}
        >
          {this.props.timestamp}
        </Kb.Text>
        {this.props.showGear && (
          <Kb.Icon
            type="iconfont-gear"
            className="small-team-gear"
            onClick={this.props.toggleShowingMenu}
            ref={this.props.setAttachmentRef}
            color={this.props.subColor}
            hoverColor={this.props.iconHoverColor}
            fontSize={14}
            style={styles.icon}
          />
        )}
        {this.props.hasBadge ? <Kb.Box key="unreadDot" style={styles.unreadDotStyle} /> : null}
      </Kb.Box>
    )
  }
}
const SimpleTopLine = Kb.OverlayParentHOC(_SimpleTopLine)

const styles = Styles.styleSheetCreate({
  bold: {...Styles.globalStyles.fontBold},
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  icon: {
    position: 'relative',
    right: Styles.globalMargins.xtiny,
  },
  insideContainer: {
    ...Styles.globalStyles.flexBoxRow,
    flexGrow: 1,
    height: Styles.isMobile ? 21 : 17,
    position: 'relative',
  },
  name: {
    paddingRight: 7,
  },
  nameContainer: {
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.globalStyles.fillAbsolute,
    alignItems: 'center',
  },
  teamTextStyle: Styles.platformStyles({
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  timestamp: {
    backgroundColor: Styles.globalColors.fastBlank,
    color: Styles.globalColors.blue,
  },
  unreadDotStyle: {
    backgroundColor: Styles.globalColors.orange,
    borderRadius: 6,
    height: 8,
    marginLeft: 4,
    width: 8,
  },
})

export {SimpleTopLine}
