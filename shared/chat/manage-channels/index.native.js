// @flow
import * as React from 'react'
import {Avatar, Text, Box, ScrollView, Checkbox, Icon, HeaderHoc} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {renameProp, compose, withProps} from 'recompose'

import type {Props, RowProps} from '.'

const Row = (props: RowProps & {onToggle: () => void}) => (
  <Box style={_rowBox}>
    <Box
      style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative', paddingRight: globalMargins.tiny}}
    >
      <Text type="BodySemibold" style={{color: globalColors.blue, maxWidth: '100%'}} lineClamp={1}>
        #{props.name}
      </Text>
      <Text type="BodySmall" lineClamp={1}>{props.description}</Text>
    </Box>
    <Checkbox checked={props.selected} label="" onCheck={props.onToggle} />
  </Box>
)

const _rowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 56,
  padding: globalMargins.small,
  width: '100%',
}

const ManageChannels = (props: Props) => (
  <Box style={_boxStyle}>
    <ScrollView style={{alignSelf: 'flex-start', width: '100%'}}>
      <Box style={_createStyle}>
        <Icon style={_createIcon} type="iconfont-new" onClick={props.onCreate} />
        <Text type="BodyBigLink" onClick={props.onCreate}>New chat channel</Text>
      </Box>
      {props.channels.map(c => <Row key={c.name} {...c} onToggle={() => props.onToggle(c.name)} />)}
    </ScrollView>
  </Box>
)

const Header = (props: Props) => (
  <Box style={_headerStyle}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 15}}>
      <Avatar isTeam={true} teamname={props.teamname} size={12} />
      <Text
        type="BodySmallSemibold"
        style={{fontSize: 11, lineHeight: 15, marginLeft: globalMargins.xtiny}}
        lineClamp={1}
      >
        {props.teamname}
      </Text>
    </Box>
    <Text type="BodyBig">
      {props.channels.length} {props.channels.length !== 1 ? 'chat channels' : 'chat channel'}
    </Text>
  </Box>
)

const _headerStyle = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  height: '100%',
  width: '100%',
}

const _createStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'stretch',
  height: 56,
  justifyContent: 'center',
}

const _createIcon = {
  color: globalColors.blue,
  marginRight: globalMargins.xtiny,
}

export default compose(
  renameProp('onClose', 'onBack'),
  withProps(props => ({
    customComponent: <Header {...props} />,
  })),
  HeaderHoc
)(ManageChannels)
