// @flow
import * as React from 'react'
import {compose, withStateHandlers, lifecycle} from '../../util/container'
import DeleteChannel from './delete-channel'
import {Avatar, Text, Box, Button, Input, StandardScreen, ButtonBar} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../styles'

type Props = {
  teamname: string,
  channelName: string,
  topic: string,
  onCancel: () => void,
  onSave: (channelName: string, topic: string) => void,
  onConfirmedDelete: () => void,
  showDelete: boolean,
  deleteRenameDisabled: boolean,
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
        hintText="Channel name"
        editable={!props.deleteRenameDisabled}
        value={props.newChannelName}
      />

      {props.deleteRenameDisabled && (
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
        </Text>
      )}

      <Input
        onChangeText={props.onChangeTopic}
        hintText="Description or topic (optional)"
        value={props.newTopic}
      />
    </Box>
    <Box style={_bottomRowStyle}>
      {!isMobile &&
        props.showDelete && (
          <DeleteChannel
            channelName={props.channelName}
            onConfirmedDelete={props.onConfirmedDelete}
            disabled={props.deleteRenameDisabled}
          />
        )}
      <ButtonBar>
        <Button type="Secondary" label="Cancel" onClick={props.onCancel} />
        <Button
          type="Primary"
          label="Save"
          disabled={props.channelName === props.newChannelName && props.topic === props.newTopic}
          onClick={() => props.onSave(props.newChannelName, props.newTopic)}
          style={{marginLeft: globalMargins.tiny}}
        />
      </ButtonBar>
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
  withStateHandlers(
    props => ({
      newChannelName: props.channelName,
      newTopic: props.topic,
    }),
    {
      onChangeChannelName: () => newChannelName => ({newChannelName}),
      onChangeTopic: () => newTopic => ({newTopic}),
    }
  ),
  lifecycle({
    componentDidUpdate(prevProps: Props) {
      if (prevProps.channelName !== this.props.channelName) {
        this.props.onChangeChannelName(this.props.channelName)
      }
      if (prevProps.topic !== this.props.topic) {
        this.props.onChangeTopic(this.props.topic)
      }
    },
  })
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

export type {Props}
export default EditChannel
