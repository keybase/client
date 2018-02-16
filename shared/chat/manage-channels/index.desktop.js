// @flow
import * as React from 'react'
import {
  Avatar,
  Text,
  Box,
  Button,
  PopupDialog,
  ScrollView,
  Checkbox,
  Icon,
  ButtonBar,
} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous} from '../../styles'

import type {Props, RowProps} from '.'

const HoverBox = glamorous(Box)({
  opacity: 0,
  '.channel-row:hover &': {
    opacity: 1,
  },
})

const Edit = ({onClick, style}: {onClick: () => void, style: Object}) => (
  <HoverBox style={style} onClick={onClick}>
    <Icon style={{height: 12, marginRight: globalMargins.xtiny}} type="iconfont-edit" />
    <Text type="BodySmallPrimaryLink">Edit</Text>
  </HoverBox>
)

const Row = (
  props: RowProps & {
    selected: boolean,
    onToggle: () => void,
    showEdit: boolean,
    onEdit: () => void,
    onClickChannel: () => void,
  }
) => (
  <Box
    className={'channel-row'}
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
        {props.showEdit && (
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

const ManageChannels = (props: Props) => (
  <PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
    <Box style={_boxStyle}>
      <Avatar isTeam={true} teamname={props.teamname} size={24} />
      <Text type="BodySmallSemibold" style={{color: globalColors.darkBlue, marginTop: globalMargins.xtiny}}>
        {props.teamname}
      </Text>
      <Text type="Header" style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}}>
        {props.channels.length} {props.channels.length !== 1 ? 'chat channels' : 'chat channel'}
      </Text>
      <ScrollView style={{alignSelf: 'flex-start', width: '100%', paddingBottom: globalMargins.xlarge}}>
        {props.channels.map(c => (
          <Row
            key={c.name}
            description={c.description}
            name={c.name}
            selected={props.nextChannelState[c.name]}
            onToggle={() => props.onToggle(c.name)}
            showEdit={!props.unsavedSubscriptions}
            onEdit={() => props.onEdit(c.convID)}
            onClickChannel={() => props.onClickChannel(c.convID)}
          />
        ))}
      </ScrollView>
      <Box style={_createStyle}>
        <Icon style={_createIcon} type="iconfont-new" onClick={props.onCreate} />
        <Text type="BodyBigLink" onClick={props.onCreate}>
          New chat channel
        </Text>
      </Box>
      <Box style={{flex: 2, ...globalStyles.flexBoxColumn, justifyContent: 'flex-end'}}>
        <ButtonBar>
          <Button type="Secondary" label="Cancel" onClick={props.onClose} />
          <Button
            type="Primary"
            label={props.unsavedSubscriptions ? 'Save' : 'Saved'}
            waiting={props.waitingForSave}
            disabled={!props.unsavedSubscriptions}
            onClick={props.onSaveSubscriptions}
            style={{marginLeft: globalMargins.tiny}}
          />
        </ButtonBar>
      </Box>
    </Box>
  </PopupDialog>
)

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
  paddingTop: globalMargins.medium,
  paddingBottom: globalMargins.medium,
  flex: 1,
}

const _createIcon = {
  color: globalColors.blue,
  display: 'block',
  hoverColor: globalColors.blue2,
  marginRight: globalMargins.xtiny,
}

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
  width: 620,
  height: 520,
}

export default ManageChannels
