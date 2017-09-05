// @flow
import * as React from 'react'
import {Avatar, Box, Button, HeaderHoc, Icon, Input, ScrollView, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {renameProp, compose, withProps} from 'recompose'

import type {Props} from '.'

const CreateChannel = (props: Props) => (
  <Box style={_boxStyle}>
    <ScrollView style={{alignSelf: 'flex-start', width: '100%'}}>
      <Box style={_inputStyle}>
        <Input
          autoFocus={true}
          style={{minWidth: 450}}
          hintText="Channel name"
          value={props.channelname}
          onEnterKeyDown={props.onSubmit}
          onChangeText={channelname => props.onChannelnameChange(channelname)}
        />
      </Box>
      <Box style={_inputStyle}>
        <Input
          autoFocus={false}
          style={{minWidth: 450}}
          hintText="Description or topic (optional)"
          value={props.description}
          onEnterKeyDown={props.onSubmit}
          onChangeText={description => props.onDescriptionChange(description)}
        />
      </Box>
      <Box style={_buttonsStyle}>
        <Button
          type="Secondary"
          onClick={props.onClose}
          label="Cancel"
          style={{marginRight: globalMargins.tiny}}
        />
        <Button type="Primary" onClick={props.onSubmit} label="Save" />
      </Box>
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

const _buttonsStyle = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.large,
}

const _inputStyle = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.large,
}

export default compose(
  renameProp('onClose', 'onBack'),
  withProps(props => ({
    customComponent: <Header {...props} />,
  })),
  HeaderHoc
)(CreateChannel)
