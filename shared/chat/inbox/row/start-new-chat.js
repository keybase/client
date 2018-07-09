// @flow
import * as React from 'react'
import {iconCastPlatformStyles, Icon, Box, ClickableBox, Text} from '../../../common-adapters'
import {
  styleSheetCreate,
  platformStyles,
  globalStyles,
  globalColors,
  globalMargins,
  isMobile,
} from '../../../styles'

type Props = {
  onNewChat: () => void,
}

const StartNewChat = (props: Props) => {
  return (
    <Box style={styles.container}>
      <ClickableBox style={styles.clickableBox} onClick={props.onNewChat}>
        <Icon
          type="iconfont-compose"
          style={iconCastPlatformStyles(styles.iconCompose)}
          hoverColor="inital"
        />
        <Text type="BodyBigLink" style={{margin: globalMargins.tiny}}>
          Start a new chat
        </Text>
      </ClickableBox>
    </Box>
  )
}

const styles = styleSheetCreate({
  clickableBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: isMobile ? globalColors.fastBlank : globalColors.blue5,
    justifyContent: 'center',
    minHeight: 48,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    position: 'relative',
  },
  iconCompose: platformStyles({
    common: {
      color: globalColors.blue,
    },
    isElectron: {
      fontSize: 16,
    },
    isMobile: {
      fontSize: 20,
      padding: globalMargins.xtiny,
    },
  }),
})

export default StartNewChat
