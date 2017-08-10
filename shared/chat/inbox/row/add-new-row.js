// @flow
import React from 'react'
import {Icon, Box, ClickableBox, LoadingLine, AutosizeInput} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {branch} from 'recompose'

let KeyHandler
if (!isMobile) {
  KeyHandler = require('../../../util/key-handler.desktop').default
}

const _AddNewRow = ({
  onNewChat,
  onSetFilter,
  onJumpToChat,
  isLoading,
}: {
  onNewChat: () => void,
  onSetFilter: (filter: string) => void,
  onJumpToChat: () => void,
  isLoading: boolean,
}) => (
  <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 48, position: 'relative'}}>
    <AutosizeInput placeholder="placeholder" value="" onChange={onSetFilter} />
    <ClickableBox
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flexGrow: 1,
        flexShrink: 0,
        justifyContent: 'center',
        paddingLeft: globalMargins.medium,
        paddingRight: globalMargins.medium,
      }}
      onClick={onNewChat}
    >
      <Icon type="iconfont-new" style={{color: globalColors.blue, marginRight: 9}} />
    </ClickableBox>
    {isLoading &&
      <Box style={{bottom: 0, left: 0, position: 'absolute', right: 0}}>
        <LoadingLine />
      </Box>}
  </Box>
)

// const _AddNewRow= ({
// onNewChat,
// onJumpToChat,
// isLoading,
// }: {
// onNewChat: () => void,
// onJumpToChat: () => void,
// isLoading: boolean,
// }) => (
// <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 48, position: 'relative'}}>
// <ClickableBox
// style={{
// ...globalStyles.flexBoxCenter,
// flexGrow: 1,
// flexShrink: 0,
// paddingLeft: globalMargins.medium,
// paddingRight: globalMargins.medium,
// }}
// onClick={onJumpToChat}
// >
// <Box
// style={{
// ...globalStyles.flexBoxRow,
// alignItems: 'center',
// backgroundColor: globalColors.lightGrey,
// borderRadius: 19,
// flexShrink: 0,
// height: globalMargins.medium,
// justifyContent: 'center',
// width: '100%',
// }}
// >
// <Icon type="iconfont-search" style={{color: globalColors.black_20, fontSize: 12}} />
// <Text type="Body" style={{color: globalColors.black_20, marginLeft: globalMargins.tiny}}>
// Jump to chat
// </Text>
// </Box>
// </ClickableBox>
// <Icon
// type="iconfont-add"
// style={{color: globalColors.black_40, marginRight: 12, marginTop: 2}}
// onClick={onNewChat}
// />
// {isLoading &&
// <Box style={{bottom: 0, left: 0, position: 'absolute', right: 0}}>
// <LoadingLine />
// </Box>}
// </Box>
// )

const AddNewRow = branch(() => !isMobile, KeyHandler)(_AddNewRow)

export default AddNewRow
