// @flow
import React, {PureComponent} from 'react'
import {Box, Text, Icon, ClickableBox} from '../../../../common-adapters'
import {
  globalStyles,
  globalColors,
  globalMargins,
  isMobile,
  desktopStyles,
  styleSheetCreate,
  platformStyles,
} from '../../../../styles'
import * as RowSizes from '../sizes'

type Props = {
  isSelected: boolean,
  channelname: string,
  isMuted: boolean,
  isError: boolean,
  showBold: boolean,
  hasUnread: boolean,
  hasBadge: boolean,
  onSelectConversation: () => void,
}

class BigTeamChannel extends PureComponent<Props> {
  render() {
    return (
      <ClickableBox onClick={this.props.onSelectConversation} style={styles.container}>
        <Box style={styles.rowContainer}>
          <Box
            className={`channel_name ${
              this.props.isSelected
                ? 'active background_color_blue'
                : 'inactive hover_background_color_blueGrey2'
            }`}
            style={styles.channelBackground}
          >
            <Text
              type={this.props.isSelected ? 'BodySemibold' : 'Body'}
              style={
                this.props.isError
                  ? styles.textError
                  : this.props.isSelected
                    ? this.props.hasUnread
                      ? styles.textSelectedBold
                      : styles.textSelected
                    : this.props.hasUnread
                      ? styles.textPlainBold
                      : styles.textPlain
              }
            >
              #{this.props.channelname}
            </Text>
            {this.props.isMuted && <MutedIcon />}
            {this.props.hasBadge && <UnreadIcon />}
          </Box>
        </Box>
      </ClickableBox>
    )
  }
}

const MutedIcon = () => (
  <>
    <Icon className="muted_icon" type="icon-shh-16" style={mutedStyle} />
    <Icon className="muted_icon_active" type="icon-shh-active-16" style={mutedStyle} />
    <Icon className="muted_icon_hover" type="icon-shh-hover-16" style={mutedStyle} />
  </>
)

const mutedStyle = {
  marginLeft: globalMargins.xtiny,
}

const UnreadIcon = () => (
  <Box style={styles.unreadContainer}>
    <Box style={styles.unread} />
  </Box>
)

const styles = styleSheetCreate({
  channelBackground: {
    ...globalStyles.flexBoxRow,
    ...(isMobile ? globalStyles.fillAbsolute : {width: '100%'}),
    alignItems: 'center',
    borderBottomLeftRadius: 3,
    borderTopLeftRadius: 3,
    marginLeft: globalMargins.large,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
  container: {flexShrink: 0, height: RowSizes.bigRowHeight},
  rowContainer: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      alignItems: 'stretch',
      height: '100%',
      paddingLeft: globalMargins.tiny,
      paddingRight: 0,
    },
    isElectron: desktopStyles.clickable,
  }),
  textError: {
    color: globalColors.red,
  },
  textPlain: {
    ...(isMobile ? {backgroundColor: globalColors.fastBlank} : {}),
    color: globalColors.black_75_on_white,
  },
  textPlainBold: {
    ...(isMobile ? {backgroundColor: globalColors.fastBlank} : {}),
    color: globalColors.black_75_on_white,
    ...globalStyles.fontBold,
  },
  textSelected: {
    color: globalColors.white,
  },
  textSelectedBold: {
    color: globalColors.white,
    ...globalStyles.fontBold,
  },
  unread: {
    backgroundColor: globalColors.orange,
    borderRadius: 6,
    flexShrink: 0,
    height: 8,
    width: 8,
  },
  unreadContainer: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'flex-end',
  },
})

export {BigTeamChannel}
