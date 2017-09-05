// @flow
import * as React from 'react'
import {Avatar, Text, Box, Button, Input, PopupDialog, ScrollView, Checkbox, Icon} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

import type {Props} from '.'

const CreateChannel = (props: Props) => (
  <PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
    <Box style={_boxStyle}>
      <Avatar isTeam={true} teamname={props.teamname} size={16} />
      <Text type="BodySmallSemibold" style={{color: globalColors.darkBlue, marginTop: globalMargins.xtiny}}>
        {props.teamname}
      </Text>
      <Text type="Header" style={{marginBottom: globalMargins.small, marginTop: globalMargins.tiny}}>
        New chat channel
      </Text>
      <Box style={_createStyle}>
        <Icon style={_createIcon} type="iconfont-back" onClick={props.onBack} />
      </Box>
      <Box style={_inputStyle}>
        <Input
          autoFocus={true}
          style={{minWidth: 450}}
          hintText="Channel name"
          value={props.channelname}
          onEnterKeyDown={props.onSubmit}
          onChangeText={channelname => props.onChannelnameChange(channelname)} />
      </Box>
      <Box style={_inputStyle}>
        <Input
          autoFocus={true}
          style={{minWidth: 450}}
          hintText="Description or topic (optional)"
          value={props.description}
          onEnterKeyDown={props.onSubmit}
          onChangeText={description => props.onDescriptionChange(description)} />
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
    </Box>
  </PopupDialog>
)

const _inputStyle = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.large,
}

const _buttonsStyle = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.large,
}

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
  display: 'block',
  marginRight: globalMargins.xtiny,
}

const _createStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  left: 32,
  position: 'absolute',
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

export default CreateChannel
