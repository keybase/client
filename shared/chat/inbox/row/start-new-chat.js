// @flow
import * as React from 'react'
import {Button, iconCastPlatformStyles, Icon, Box, Box2, ClickableBox, Text} from '../../../common-adapters'
import {
  styleSheetCreate,
  platformStyles,
  globalStyles,
  globalColors,
  globalMargins,
  isMobile,
} from '../../../styles'
import flags from '../../../util/feature-flags'

type Props = {
  onNewChat: () => void,
}

const StartNewChat = (props: Props) => {
  if (!flags.useNewRouter || isMobile) {
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
  return (
    <Box2 direction="horizontal" fullWidth={true}>
      <Button
        type="Primary"
        label="Start a new chat"
        onClick={props.onNewChat}
        style={styles.button}
        small={true}
      >
        <Icon type="iconfont-compose" color={globalColors.white} style={styles.buttonIcon} />
      </Button>
    </Box2>
  )
}

const styles = styleSheetCreate({
  button: {
    flexGrow: 1,
    marginLeft: globalMargins.small,
    marginRight: globalMargins.small,
  },
  buttonIcon: {
    marginRight: globalMargins.tiny,
  },
  clickableBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: isMobile ? globalColors.fastBlank : globalColors.blueGrey,
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
