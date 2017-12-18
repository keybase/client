// @flow
import * as React from 'react'
import {Avatar, Box, Button, HeaderHoc, Input, Text, ButtonBar} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {renameProp, compose, withProps} from 'recompose'

import type {Props} from '.'

const errorHeader = (errorText: string) => {
  if (!errorText) {
    return null
  }

  return (
    <Box
      style={{
        backgroundColor: globalColors.red,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
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
  <Box>
    {errorHeader(props.errorText)}
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
      <ButtonBar>
        <Button type="Primary" onClick={props.onSubmit} label="Save" />
      </ButtonBar>
    </Box>
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
    <Text type="BodyBig">New channel</Text>
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
