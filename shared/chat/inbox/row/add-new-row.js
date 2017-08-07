// @flow
import React from 'react'
import {Text, Icon, Box, ClickableBox, LoadingLine} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {branch} from 'recompose'

let KeyHandler
if (!isMobile) {
  KeyHandler = require('../../../util/key-handler.desktop').default
}

const _AddNewRow = ({onNewChat, isLoading}: {onNewChat: () => void, isLoading: boolean}) => (
  <Box style={{...globalStyles.flexBoxColumn, minHeight: 48, position: 'relative'}}>
    <ClickableBox style={{...globalStyles.flexBoxColumn, flex: 1, flexShrink: 0}} onClick={onNewChat}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', justifyContent: 'center', flex: 1}}>
        <Icon type="iconfont-new" style={{color: globalColors.blue, marginRight: 9}} />
        <Text type="BodyBigLink">New chat</Text>
      </Box>
    </ClickableBox>
    {isLoading &&
      <Box style={{bottom: 0, left: 0, position: 'absolute', right: 0}}>
        <LoadingLine />
      </Box>}
  </Box>
)

const AddNewRow = branch(() => !isMobile, KeyHandler)(_AddNewRow)

export default AddNewRow
