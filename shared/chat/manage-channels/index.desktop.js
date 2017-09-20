// @flow
import * as React from 'react'
import {Avatar, Text, Box, PopupDialog, ScrollView, Checkbox, Icon} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

import type {Props, RowProps} from '.'

const Row = (props: RowProps & {onToggle: () => void}) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      paddingLeft: globalMargins.medium,
      paddingRight: globalMargins.medium,
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 40}}>
      <Box style={_rowBox}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', width: 16}}>
          <Checkbox
            checked={props.selected}
            label=""
            onCheck={props.onToggle}
            style={{alignSelf: 'flext-start', marginRight: 0}}
          />
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.tiny, height: 32}}>
          <Text type="BodySemibold" style={{color: globalColors.blue}}>#{props.name}</Text>
          <Text type="BodySmall">{props.description}</Text>
        </Box>
      </Box>
    </Box>
  </Box>
)

const _rowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  flex: 1,
  paddingBottom: globalMargins.xtiny,
  paddingTop: globalMargins.xtiny,
}

const ManageChannels = (props: Props) => (
  <PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
    <Box style={_boxStyle}>
      <Avatar isTeam={true} teamname={props.teamname} size={24} style={{minHeight: 24}} />
      <Text type="BodySmallSemibold" style={{color: globalColors.darkBlue, marginTop: globalMargins.xtiny}}>
        {props.teamname}
      </Text>
      <Text type="Header" style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}}>
        {props.channels.length} {props.channels.length !== 1 ? 'chat channels' : 'chat channel'}
      </Text>
      <ScrollView style={{alignSelf: 'flex-start', width: '100%', paddingBottom: globalMargins.xlarge}}>
        {props.channels.map(c => <Row key={c.name} {...c} onToggle={() => props.onToggle(c.name)} />)}
      </ScrollView>
      <Box style={_createStyle}>
        <Icon style={_createIcon} type="iconfont-new" onClick={props.onCreate} />
        <Text type="BodyBigLink" onClick={props.onCreate}>New chat channel</Text>
      </Box>
    </Box>
  </PopupDialog>
)

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
  paddingTop: globalMargins.medium,
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
  alignItems: 'center',
  backgroundColor: globalColors.black_60,
  justifyContent: 'center',
}

const _styleContainer = {
  width: 620,
  height: 520,
}

export default ManageChannels
