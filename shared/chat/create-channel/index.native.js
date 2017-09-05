// @flow
import * as React from 'react'
import {Avatar, Text, Box, ScrollView, Checkbox, Icon, HeaderHoc} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {renameProp, compose, withProps} from 'recompose'

import type {Props} from '.'

const CreateChannel = (props: Props) => (
  <Box style={_boxStyle}>
    <ScrollView style={{alignSelf: 'flex-start', width: '100%'}}>
      <Box style={_backStyle}>
        <Icon style={_backIcon} type="iconfont-back" onClick={props.onBack} />
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
        style={{color: globalColors.darkBlue, fontSize: 11, lineHeight: 15, marginLeft: globalMargins.xtiny}}
        lineClamp={1}
      >
        {props.teamname}
      </Text>
    </Box>
    <Text type="BodySmallSemibold" style={{color: globalColors.black_75}}>
      New chat channel
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
  height: '100%',
  padding: 16,
  width: '100%',
}

const _backStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'stretch',
  height: 56,
  justifyContent: 'center',
}

const _backIcon = {
  color: globalColors.blue,
  marginRight: globalMargins.xtiny,
}

export default compose(
  renameProp('onClose', 'onBack'),
  withProps(props => ({
    customComponent: <Header {...props} />,
  })),
  HeaderHoc
)(CreateChannel)
