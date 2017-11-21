// @flow
import * as React from 'react'
import {compose, withState} from 'recompose'
import DeleteChannel from './delete-channel'
import {Avatar, Text, Box, Button, Input, StandardScreen} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'

type Props = {
  teamname: string,
  channelName: string,
  topic: string,
  onCancel: () => void,
  onSave: (channelName: string, topic: string) => void,
  onConfirmedDelete: () => void,
  showDelete: boolean,
  deleteRenameDisabled: boolean,
  waitingForSave: boolean,
}

type TextState = {
  newChannelName: string,
  onChangeChannelName: (nextChannelName: string) => void,
  newTopic: string,
  onChangeTopic: (nextTopic: string) => void,
}

const EditChannelBare = (props: Props & TextState) => (
  <Box style={_boxStyle}>
    <Avatar isTeam={true} teamname={props.teamname} size={24} />
    <Text type="BodySmallSemibold" style={{color: globalColors.darkBlue, marginTop: globalMargins.xtiny}}>
      {props.teamname}
    </Text>
    <Text type="Header" style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}}>
      Edit #{props.channelName}
    </Text>
    <Box style={{position: 'relative'}}>
      <Input
        onChangeText={props.onChangeChannelName}
        hintText={'Channel name'}
        editable={!props.deleteRenameDisabled}
        value={props.newChannelName}
      />

      {props.deleteRenameDisabled &&
        <Text
          type="BodySmall"
          style={{
            position: 'absolute',
            textAlign: 'center',
            left: 0,
            right: 0,
            top: 60,
          }}
        >
          #general can’t be renamed or deleted.
        </Text>}

      <Input
        onChangeText={props.onChangeTopic}
        hintText={'Description or topic (optional)'}
        value={props.newTopic}
      />
    </Box>
    <Box style={_bottomRowStyle}>
      {props.showDelete &&
        <DeleteChannel
          channelName={props.channelName}
          onConfirmedDelete={props.onConfirmedDelete}
          disabled={props.deleteRenameDisabled}
        />}
      <Box style={globalStyles.flexBoxRow}>
        <Button type="Secondary" label="Cancel" onClick={props.onCancel} />
        <Button
          type="Primary"
          label="Save"
          waiting={props.waitingForSave}
          disabled={props.channelName === props.newChannelName && props.topic === props.newTopic}
          onClick={() => props.onSave(props.newChannelName, props.newTopic)}
          style={{marginLeft: globalMargins.tiny}}
        />
      </Box>
    </Box>
  </Box>
)

// TODO(mm) this should be handled at a higher level
const _EditChannelOnStandardScreen = (props: Props & TextState) => (
  <StandardScreen onBack={props.onCancel}>
    <EditChannelBare {...props} />
  </StandardScreen>
)

const EditChannel: React.ComponentType<Props> = compose(
  withState('newChannelName', 'onChangeChannelName', ({channelName}: Props) => channelName),
  withState('newTopic', 'onChangeTopic', ({topic}: Props) => topic)
)(isMobile ? _EditChannelOnStandardScreen : EditChannelBare)

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
  paddingTop: globalMargins.medium,
  paddingBottom: globalMargins.medium,
  ...(isMobile ? {flex: 1} : {}),
}

const _bottomRowStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  alignSelf: 'stretch',
  alignItems: 'flex-end',
  justifyContent: 'center',
  position: 'relative',
  ...(isMobile ? {} : {minWidth: '500px'}),
}

export default EditChannel
