// @flow
import * as React from 'react'
import {
  Avatar,
  Text,
  Box,
  Button,
  ClickableBox,
  ScrollView,
  Checkbox,
  Icon,
  HeaderHoc,
} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {renameProp, compose, withProps} from 'recompose'

import type {Props, RowProps} from '.'

const Edit = ({onClick, style}: {onClick: () => void, style: Object}) => (
  <ClickableBox style={style} onClick={onClick}>
    <Icon style={{height: 16, marginRight: globalMargins.xtiny}} type="iconfont-edit" />
    <Text type="BodySmallPrimaryLink">Edit</Text>
  </ClickableBox>
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
  <Box style={_rowBox}>
    <Checkbox
      disabled={props.name.toLowerCase() === 'general'}
      style={{alignSelf: 'flex-end'}}
      checked={props.selected}
      label=""
      onCheck={props.onToggle}
    />
    <Box
      style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative', paddingLeft: globalMargins.tiny}}
    >
      <Text
        type="BodySemiboldLink"
        onClick={props.onClickChannel}
        style={{color: globalColors.blue, maxWidth: '100%'}}
        lineClamp={1}
      >
        #{props.name}
      </Text>
      <Text type="BodySmall" lineClamp={1}>
        {props.description}
      </Text>
    </Box>
    <Edit
      style={{
        ...globalStyles.flexBoxRow,
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
      onClick={props.onEdit}
    />
  </Box>
)

const _rowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 56,
  padding: globalMargins.small,
  width: '100%',
}

const ManageChannels = (props: Props) => (
  <Box style={_boxStyle}>
    <ScrollView style={{alignSelf: 'flex-start', width: '100%'}}>
      <Box style={_createStyle}>
        <Icon style={_createIcon} type="iconfont-new" onClick={props.onCreate} />
        <Text type="BodyBigLink" onClick={props.onCreate}>
          New chat channel
        </Text>
      </Box>
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
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        justifyContent: 'flex-end',
        paddingBottom: globalMargins.small,
      }}
    >
      <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
        <Button
          type="Primary"
          label={props.unsavedSubscriptions ? 'Save' : 'Saved'}
          waiting={props.waitingForSave}
          disabled={!props.unsavedSubscriptions}
          onClick={props.onSaveSubscriptions}
          style={{marginLeft: globalMargins.tiny}}
        />
      </Box>
    </Box>
  </Box>
)

const Header = (props: Props) => (
  <Box style={_headerStyle}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 15}}>
      <Avatar isTeam={true} teamname={props.teamname} size={12} />
      <Text
        type="BodySmallSemibold"
        style={platformStyles({isMobile: {fontSize: 11, lineHeight: 15, marginLeft: globalMargins.xtiny}})}
        lineClamp={1}
      >
        {props.teamname}
      </Text>
    </Box>
    <Text type="BodyBig">
      {props.channels.length} {props.channels.length !== 1 ? 'chat channels' : 'chat channel'}
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
  backgroundColor: globalColors.white,
  height: '100%',
  width: '100%',
}

const _createStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'stretch',
  height: 56,
  justifyContent: 'center',
}

const _createIcon = {
  color: globalColors.blue,
  marginRight: globalMargins.xtiny,
}

export default compose(
  renameProp('onClose', 'onBack'),
  withProps(props => ({
    customComponent: <Header {...props} />,
  })),
  HeaderHoc
)(ManageChannels)
