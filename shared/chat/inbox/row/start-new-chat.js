// @flow
import * as React from 'react'
import {Icon, Box, ClickableBox, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../../styles'

type Props = {
  onNewChat: () => void,
}

const StartNewChat = (props: Props) => {
  return (
    <Box style={styleContainer}>
      <ClickableBox style={{...stylesClickableBox}} onClick={() => undefined}>
        <Icon
          type="iconfont-compose"
          style={propsIconPlatform.style}
          color={propsIconPlatform.color}
          hoverColor="inital"
          fontSize={propsIconPlatform.fontSize}
          onClick={props.onNewChat}
        />
        <Text type="BodyBigLink" style={{margin: globalMargins.tiny}}>
          Start a new chat
        </Text>
      </ClickableBox>
    </Box>
  )
}
const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: isMobile ? globalColors.fastBlank : globalColors.blue5,
  justifyContent: 'center',
  minHeight: 48,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  position: 'relative',
}

const stylesClickableBox = {
  alignItems: 'center',
  flexDirection: 'row',
}

const propsIconCompose = {
  color: globalColors.blue,
  fontSize: 16,
  style: {},
}

const propsIconComposeMobile = {
  ...propsIconCompose,
  fontSize: 20,
  style: {
    padding: globalMargins.xtiny,
  },
}
const propsIconPlatform = isMobile ? propsIconComposeMobile : propsIconCompose

export default StartNewChat
