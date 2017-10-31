// @flow
import * as React from 'react'
import {compose, withState} from 'recompose'
import {Avatar, Text, Box, Button, Input, Icon} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

type Props = {
  teamname: string,
  channelName: string,
  topic: string,
  onCancel: () => void,
  onSave: (channelName: string, topic: string) => void,
  onDelete: () => void,
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

const DeleteChannel = ({onClick, disabled}: {onClick: () => void, disabled: boolean}) => (
  <Box
    style={{...globalStyles.flexBoxRow, position: 'absolute', left: 0, opacity: disabled ? 0.5 : undefined}}
  >
    <Icon
      type="iconfont-trash"
      style={{height: 14, color: globalColors.red, marginRight: globalMargins.tiny}}
    />
    <Text
      type={disabled ? 'Body' : 'BodyPrimaryLink'}
      style={{color: globalColors.red}}
      onClick={disabled ? undefined : onClick}
    >
      Delete Channel
    </Text>
  </Box>
)

const _EditChannel = (props: Props & TextState) => (
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
      {props.showDelete && <DeleteChannel onClick={props.onDelete} disabled={props.deleteRenameDisabled} />}
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
)

const EditChannel: React.ComponentType<Props> = compose(
  withState('newChannelName', 'onChangeChannelName', ({channelName}: Props) => channelName),
  withState('newTopic', 'onChangeTopic', ({topic}: Props) => topic)
)(_EditChannel)

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
  paddingTop: globalMargins.medium,
  paddingBottom: globalMargins.medium,
}

const _bottomRowStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  alignSelf: 'stretch',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  minWidth: '500px',
}

export default EditChannel
