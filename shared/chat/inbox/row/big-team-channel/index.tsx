import React, {PureComponent} from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RowSizes from '../sizes'

type Props = {
  isSelected: boolean
  channelname: string
  isMuted: boolean
  isError: boolean
  showBold: boolean
  hasUnread: boolean
  hasBadge: boolean
  hasDraft: boolean
  onSelectConversation: () => void
}

class BigTeamChannel extends PureComponent<Props> {
  render() {
    return (
      <Kb.ClickableBox onClick={this.props.onSelectConversation} style={styles.container}>
        <Kb.Box style={styles.rowContainer}>
          <Kb.Box2
            className="hover_background_color_blueGreyDark"
            direction="horizontal"
            fullWidth={!Styles.isMobile}
            style={Styles.collapseStyles([
              styles.channelBackground,
              this.props.isSelected && styles.selectedChannelBackground,
            ])}
          >
            <Kb.Text
              lineClamp={1}
              type="Body"
              style={Styles.collapseStyles([
                styles.channelHash,
                this.props.isSelected && styles.channelHashSelected,
              ])}
            >
              #{' '}
              <Kb.Text
                type={this.props.isSelected ? 'BodySemibold' : 'Body'}
                style={Styles.collapseStyles([
                  styles.channelText,
                  this.props.isError
                    ? styles.textError
                    : this.props.isSelected
                    ? this.props.hasUnread
                      ? styles.textSelectedBold
                      : styles.textSelected
                    : this.props.hasUnread
                    ? styles.textPlainBold
                    : styles.textPlain,
                ])}
              >
                {this.props.channelname}
              </Kb.Text>
            </Kb.Text>
            {this.props.isMuted && <MutedIcon isSelected={this.props.isSelected} />}
            {this.props.hasDraft && <DraftIcon isSelected={this.props.isSelected} />}
            {this.props.hasBadge && <UnreadIcon />}
          </Kb.Box2>
        </Kb.Box>
      </Kb.ClickableBox>
    )
  }
}

const MutedIcon = ({isSelected}) => (
  <Kb.Icon
    color={isSelected ? Styles.globalColors.white : Styles.globalColors.black_20}
    style={styles.muted}
    type={Styles.isMobile ? (isSelected ? 'icon-shh-active-26-21' : 'icon-shh-26-21') : 'iconfont-shh'}
  />
)

const UnreadIcon = () => (
  <Kb.Box style={styles.unreadContainer}>
    <Kb.Box style={styles.unread} />
  </Kb.Box>
)

const DraftIcon = ({isSelected}) => (
  <Kb.Box style={styles.unreadContainer}>
    <Kb.Icon type="iconfont-edit" color={isSelected ? Styles.globalColors.white : undefined} />
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(() => ({
  channelBackground: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      marginLeft: Styles.globalMargins.large,
      paddingRight: Styles.globalMargins.tiny,
    },
    isElectron: {
      borderBottomLeftRadius: 3,
      borderTopLeftRadius: 3,
      paddingLeft: Styles.globalMargins.tiny,
    },
    isMobile: {
      ...Styles.globalStyles.fillAbsolute,
      flex: 1,
      paddingLeft: Styles.globalMargins.small,
    },
  }),
  channelHash: {
    color: Styles.globalColors.black_20,
  },
  channelHashSelected: {
    color: Styles.globalColors.white_60,
  },
  channelText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  container: {flexShrink: 0, height: RowSizes.bigRowHeight},
  muted: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  rowContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'stretch',
      height: '100%',
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: 0,
    },
    isElectron: Styles.desktopStyles.clickable,
  }),
  selectedChannelBackground: {
    backgroundColor: Styles.globalColors.blue,
  },
  textError: {
    color: Styles.globalColors.redDark,
  },
  textPlain: Styles.platformStyles({
    common: {color: Styles.globalColors.black_63},
    isMobile: {backgroundColor: Styles.globalColors.fastBlank},
  }),
  textPlainBold: Styles.platformStyles({
    common: {
      color: Styles.globalColors.blackOrWhite,
      ...Styles.globalStyles.fontBold,
    },
    isMobile: {backgroundColor: Styles.globalColors.fastBlank},
  }),
  textSelected: {
    color: Styles.globalColors.white,
  },
  textSelectedBold: {
    color: Styles.globalColors.white,
    ...Styles.globalStyles.fontBold,
  },
  unread: {
    backgroundColor: Styles.globalColors.orange,
    borderRadius: Styles.borderRadius,
    flexShrink: 0,
    height: 8,
    width: 8,
  },
  unreadContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'flex-end',
  },
}))

export {BigTeamChannel}
