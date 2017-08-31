// @flow
import * as React from 'react'
import {Avatar, Text, Box, PopupDialog, ScrollView, Checkbox, Icon} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

import type {Props, RowProps} from '.'

const Row = (props: RowProps & {onToggle: () => void}) => (
  <Box style={_rowBox}>
    <Checkbox checked={props.selected} label="" onCheck={props.onToggle} style={{marginTop: 3}} />
    <Box style={globalStyles.flexBoxColumn}>
      <Text type="BodySemibold" style={{color: globalColors.blue}}>#{props.name}</Text>
      <Text type="BodySmall">{props.description}</Text>
    </Box>
  </Box>
)

const _rowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  flexShrink: 0,
  height: 40,
  paddingLeft: globalMargins.large,
  paddingTop: 6,
  width: '100%',
}

const ManageChannels = (props: Props) => (
  <PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
    <Box style={_boxStyle}>
      <Avatar isTeam={true} teamname={props.teamname} size={16} />
      <Text type="BodySmallSemibold" style={{color: globalColors.darkBlue, marginTop: globalMargins.xtiny}}>
        {props.teamname}
      </Text>
      <Text type="Header" style={{marginBottom: globalMargins.small, marginTop: globalMargins.tiny}}>
        {props.channels.length} chat channels
      </Text>
      <ScrollView style={{alignSelf: 'flex-start', width: '100%'}}>
        {props.channels.map(c => <Row key={c.name} {...c} onToggle={() => props.onToggle(c.name)} />)}
      </ScrollView>
      <Box style={_createStyle}>
        <Icon style={_createIcon} type="iconfont-new" onClick={props.onCreate} />
        <Text type="BodyBigLink" onClick={props.onCreate}>Create chat channel</Text>
      </Box>
    </Box>
  </PopupDialog>
)

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: '100%',
  paddingLeft: 32,
  paddingRight: 32,
  paddingTop: 32,
  position: 'relative',
  width: '100%',
}

const _createIcon = {
  color: globalColors.blue,
  display: 'block',
  hoverColor: globalColors.blue2,
  marginRight: globalMargins.xtiny,
}

const _createStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  position: 'absolute',
  right: 32,
  top: 32,
}

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: globalColors.black_75,
  justifyContent: 'stretch',
}

const _styleContainer = {
  height: '100%',
}

export default ManageChannels
