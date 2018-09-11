// @flow
import * as React from 'react'
import {Avatar, Box, Button, Icon, Input, PopupDialog, Text, ButtonBar} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import type {Props} from './index.types'

const errorHeader = (errorText: string) => {
  if (!errorText) {
    return null
  }

  return (
    <Box style={{..._boxStyle, backgroundColor: globalColors.red}}>
      <Text
        style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
        type="BodySemibold"
        backgroundMode={'HighRisk'}
      >
        {errorText}
      </Text>
    </Box>
  )
}

const CreateChannel = (props: Props) => (
  <PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
    <Box style={{..._boxStyle, paddingTop: globalMargins.medium}}>
      <Avatar isTeam={true} teamname={props.teamname} size={32} />
      <Text type="BodySmallSemibold" style={{marginTop: globalMargins.xtiny}}>
        {props.teamname}
      </Text>
      <Text type="Header" style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}}>
        New chat channel
      </Text>
    </Box>
    {errorHeader(props.errorText)}
    <Box style={_boxStyle}>
      <Box style={_backStyle} onClick={props.onBack}>
        <Icon style={_backIcon} type="iconfont-arrow-left" />
        <Text type="BodyPrimaryLink" onClick={props.onBack}>
          Back
        </Text>
      </Box>
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
      <ButtonBar>
        <Button type="Secondary" onClick={props.onClose} label="Cancel" />
        <Button type="Primary" onClick={props.onSubmit} label="Save" />
      </ButtonBar>
    </Box>
  </PopupDialog>
)

const _inputStyle = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.medium,
}

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
}

const _backIcon = platformStyles({
  common: {
    marginRight: globalMargins.xtiny,
  },
  isElectron: {
    display: 'block',
  },
})

const _backStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  left: 32,
  position: 'absolute',
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

export default CreateChannel
