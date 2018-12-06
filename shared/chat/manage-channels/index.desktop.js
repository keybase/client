// @flow
import * as React from 'react'
import {
  Avatar,
  Text,
  Box,
  Button,
  PopupDialog,
  ProgressIndicator,
  ScrollView,
  Checkbox,
  Icon,
  ButtonBar,
  WaitingButton,
} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous, platformStyles} from '../../styles'

import type {Props, RowProps} from './index.types'

const HoverBox = glamorous(Box)({
  '.channel-row:hover &': {
    opacity: 1,
  },
  opacity: 0,
})

const Edit = ({onClick, style}: {onClick: () => void, style: Object}) => (
  <HoverBox style={style} onClick={onClick}>
    <Icon style={{height: 12, marginRight: globalMargins.xtiny}} type="iconfont-edit" />
    <Text type="BodySmallPrimaryLink">Edit</Text>
  </HoverBox>
)

const Row = (
  props: RowProps & {
    canEditChannels: boolean,
    selected: boolean,
    onToggle: () => void,
    showEdit: boolean,
    onEdit: () => void,
    onClickChannel: () => void,
  }
) => (
  <Box
    className="channel-row"
    style={{
      ...globalStyles.flexBoxColumn,
      paddingLeft: globalMargins.medium,
      paddingRight: globalMargins.medium,
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 40}}>
      <Box style={_rowBox}>
        <Box
          style={{...globalStyles.flexBoxRow, alignItems: 'center', width: 16}}
          title={
            props.name.toLowerCase() === 'general' ? 'Leaving the general channel is disabled' : undefined
          }
        >
          <Checkbox
            checked={props.selected}
            label=""
            onCheck={props.onToggle}
            style={{alignSelf: 'flex-start', marginRight: 0}}
            disabled={props.name.toLowerCase() === 'general'}
          />
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.tiny, minHeight: 32}}>
          <Text type="BodySemiboldLink" onClick={props.onClickChannel} style={{color: globalColors.blue}}>
            #{props.name}
          </Text>
          <Text type="BodySmall">{props.description}</Text>
        </Box>
        {props.showEdit && props.canEditChannels && (
          <Edit
            style={{
              ...globalStyles.flexBoxRow,
              flex: 1,
              justifyContent: 'flex-end',
            }}
            onClick={props.onEdit}
          />
        )}
      </Box>
    </Box>
  </Box>
)

const _rowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  flex: 1,
  paddingBottom: globalMargins.xtiny,
  paddingTop: globalMargins.xtiny,
}

const ManageChannels = (props: Props) => {
  let channelDisplay
  if (props.channels.length === 0 || props.waitingForGet) {
    channelDisplay = <ProgressIndicator style={{width: 48}} />
  } else {
    channelDisplay = (
      <Text type="Header" style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}}>
        {props.channels.length} {props.channels.length !== 1 ? 'chat channels' : 'chat channel'}
      </Text>
    )
  }
  return (
    <PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
      {props.canCreateChannels && (
        <Box style={_createStyle}>
          <Icon
            style={_createIcon}
            type="iconfont-new"
            onClick={props.onCreate}
            hoverColor={_hoverColor}
            color={globalColors.blue}
          />
          <Text type="BodyBigLink" onClick={props.onCreate}>
            New chat channel
          </Text>
        </Box>
      )}
      <Box style={_boxStyle}>
        <Avatar isTeam={true} teamname={props.teamname} size={32} />
        <Text type="BodySmallSemibold" style={{marginTop: globalMargins.xtiny}}>
          {props.teamname}
        </Text>
        {channelDisplay}
        <ScrollView style={{flex: 1, width: '100%'}}>
          {props.channels.map(c => (
            <Row
              key={c.convID}
              canEditChannels={props.canEditChannels}
              description={c.description}
              name={c.name}
              selected={props.nextChannelState[c.convID]}
              onToggle={() => props.onToggle(c.convID)}
              showEdit={!props.unsavedSubscriptions}
              onEdit={() => props.onEdit(c.convID)}
              onClickChannel={() => props.onClickChannel(c.name)}
            />
          ))}
        </ScrollView>
        <ButtonBar style={{alignSelf: 'flex-end'}}>
          <Button type="Secondary" label="Cancel" onClick={props.onClose} />
          <WaitingButton
            type="Primary"
            label={props.unsavedSubscriptions ? 'Save' : 'Saved'}
            waitingKey={props.waitingKey}
            disabled={!props.unsavedSubscriptions}
            onClick={props.onSaveSubscriptions}
            style={{marginLeft: globalMargins.tiny}}
          />
        </ButtonBar>
      </Box>
    </PopupDialog>
  )
}

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  paddingBottom: globalMargins.medium,
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
  paddingTop: globalMargins.medium,
}

const _createIcon = platformStyles({
  common: {
    marginRight: globalMargins.xtiny,
  },
  isElectron: {
    display: 'block',
  },
})

const _hoverColor = globalColors.blue2

const _createStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  position: 'absolute',
  right: 32,
  top: 32,
}

const _styleCover = {
  alignItems: 'center',
  backgroundColor: globalColors.black_60,
  justifyContent: 'center',
}

const _styleContainer = {
  height: 520,
  width: 620,
}

export default ManageChannels
