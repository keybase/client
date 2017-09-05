// @flow
import * as React from 'react'
import {Avatar, Box, Button, HeaderHoc, Input, ScrollView, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {renameProp, compose, withProps} from 'recompose'

import type {Props} from '.'

const CreateChannel = (props: Props) => (
  <Box style={_boxStyle}>
    <Box style={_inputStyle}>
      <Input
        autoFocus={true}
        hintText="Channel name"
        value={props.channelname}
        onChangeText={channelname => props.onChannelnameChange(channelname)}
      />
    </Box>
    <Box style={_inputStyle}>
      <Input
        autoCorrect={true}
        autoFocus={false}
        hintText="Description or topic (optional)"
        value={props.description}
        onChangeText={description => props.onDescriptionChange(description)}
      />
    </Box>
    <Box style={_buttonsStyle}>
      <Button type="Primary" onClick={props.onSubmit} label="Save" />
    </Box>
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
      New channel
    </Text>
  </Box>
)

const _headerStyle = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const _boxStyle = {
  padding: 16,
}

const _buttonsStyle = {
  alignItems: 'center',  
  marginTop: globalMargins.large,
}

const _inputStyle = {
  marginTop: globalMargins.large,
}

export default compose(
  renameProp('onBack', 'onCancel'),
  withProps(props => ({
    customComponent: <Header {...props} />,
  })),
  HeaderHoc
)(CreateChannel)
