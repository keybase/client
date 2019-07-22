import * as React from 'react'
import * as Kb from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Props, RowProps} from './index.types'
import {pluralize} from '../../util/string'

const Edit = ({onClick, style}: {onClick: () => void; style: Object}) => (
  <Kb.ClickableBox style={style} onClick={onClick}>
    <Kb.Icon style={{marginRight: globalMargins.xtiny}} type="iconfont-edit" sizeType="Small" />
    <Kb.Text type="BodySmallPrimaryLink">Edit</Kb.Text>
  </Kb.ClickableBox>
)

const Row = (
  props: RowProps & {
    canEditChannels: boolean
    selected: boolean
    onToggle: () => void
    showEdit: boolean
    onEdit: () => void
    onClickChannel: () => void
  }
) => (
  <Kb.Box style={_rowBox}>
    <Kb.Checkbox
      disabled={props.name.toLowerCase() === 'general'}
      style={{alignSelf: 'center'}}
      checked={props.selected}
      label=""
      onCheck={props.onToggle}
    />
    <Kb.Box style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative'}}>
      <Kb.Text
        type="BodySemiboldLink"
        onClick={props.onClickChannel}
        style={{color: globalColors.blueDark, maxWidth: '100%'}}
        lineClamp={1}
      >
        #{props.name}
      </Kb.Text>
      {!!props.description && (
        <Kb.Text type="BodySmall" lineClamp={1}>
          {props.description}
        </Kb.Text>
      )}
      <Kb.Text type="BodySmall">
        {props.numParticipants} {pluralize('member', props.numParticipants)}{' '}
        {props.hasAllMembers ? '(entire team)' : ''}
      </Kb.Text>
      <Kb.Text type="BodySmall">Last activity {props.mtimeHuman} </Kb.Text>
    </Kb.Box>
    {props.showEdit && props.canEditChannels && (
      <Edit
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
        onClick={props.onEdit}
      />
    )}
  </Kb.Box>
)

const _rowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  paddingBottom: globalMargins.small,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  width: '100%',
}

const ManageChannels = (props: Props) => (
  <Kb.Box style={_boxStyle}>
    <Kb.ScrollView style={{alignSelf: 'flex-start', width: '100%'}}>
      {props.canCreateChannels && (
        <Kb.Box style={_createStyle}>
          <Kb.Icon
            style={_createIcon}
            type="iconfont-new"
            onClick={props.onCreate}
            color={globalColors.blue}
          />
          <Kb.Text type="BodyBigLink" onClick={props.onCreate}>
            New chat channel
          </Kb.Text>
        </Kb.Box>
      )}
      {props.channels.map(c => (
        <Row
          key={c.convID}
          canEditChannels={props.canEditChannels}
          description={c.description}
          hasAllMembers={c.hasAllMembers}
          name={c.name}
          numParticipants={c.numParticipants}
          mtimeHuman={c.mtimeHuman}
          selected={props.nextChannelState[c.convID]}
          onToggle={() => props.onToggle(c.convID)}
          showEdit={!props.unsavedSubscriptions}
          onEdit={() => props.onEdit(c.convID)}
          onClickChannel={() => props.onClickChannel(c.name)}
        />
      ))}
    </Kb.ScrollView>
    <Kb.Box
      style={{
        borderStyle: 'solid',
        borderTopColor: globalColors.black_10,
        borderTopWidth: 1,
        ...globalStyles.flexBoxColumn,
        justifyContent: 'flex-end',
        padding: globalMargins.small,
      }}
    >
      <Kb.Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
        <Kb.WaitingButton
          fullWidth={true}
          label={props.unsavedSubscriptions ? 'Save' : 'Saved'}
          waitingKey={props.waitingKey}
          disabled={!props.unsavedSubscriptions}
          onClick={props.onSaveSubscriptions}
        />
      </Kb.Box>
    </Kb.Box>
  </Kb.Box>
)

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
  marginRight: globalMargins.xtiny,
}

const Wrapper = (p: Props) => <ManageChannels {...p} onClose={undefined} />

export default Kb.HeaderHoc(Wrapper)
