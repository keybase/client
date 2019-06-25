import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props, RowProps} from './index.types'
import {pluralize} from '../../util/string'

const HoverBox = Styles.styled(Kb.Box)({
  '.channel-row:hover &': {opacity: 1},
  opacity: 0,
})

const Edit = ({onClick, style}: {onClick: () => void; style: Object}) => (
  <HoverBox style={style} onClick={onClick}>
    <Kb.Icon style={{marginRight: Styles.globalMargins.xtiny}} type="iconfont-edit" />
    <Kb.Text type="BodySmallPrimaryLink">Edit</Kb.Text>
  </HoverBox>
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
  <Kb.Box
    className="channel-row"
    style={{
      ...Styles.globalStyles.flexBoxColumn,
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    }}
  >
    <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', minHeight: 40}}>
      <Kb.Box style={_rowBox}>
        <Kb.Box
          style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', width: 16}}
          title={
            props.name.toLowerCase() === 'general' ? 'Leaving the general channel is disabled' : undefined
          }
        >
          <Kb.Checkbox
            checked={props.selected}
            label=""
            onCheck={props.onToggle}
            style={{alignSelf: 'flex-start', marginRight: 0}}
            disabled={props.name.toLowerCase() === 'general'}
          />
        </Kb.Box>
        <Kb.Box
          style={{...Styles.globalStyles.flexBoxColumn, marginLeft: Styles.globalMargins.tiny, minHeight: 32}}
        >
          <Kb.Text
            type="BodySemiboldLink"
            onClick={props.onClickChannel}
            style={{color: Styles.globalColors.blueDark}}
          >
            #{props.name}
          </Kb.Text>
          <Kb.Text type="BodySmall" lineClamp={1}>
            {props.description}
          </Kb.Text>
          <Kb.Text type="BodySmall">
            {props.numParticipants} {pluralize('member', props.numParticipants)}{' '}
            {props.hasAllMembers ? '(entire team)' : ''} &bull; Last activity {props.mtimeHuman}{' '}
          </Kb.Text>
        </Kb.Box>
        {props.showEdit && props.canEditChannels && (
          <Edit
            style={{
              ...Styles.globalStyles.flexBoxRow,
              flex: 1,
              justifyContent: 'flex-end',
            }}
            onClick={props.onEdit}
          />
        )}
      </Kb.Box>
    </Kb.Box>
  </Kb.Box>
)

const _rowBox = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  flex: 1,
  paddingBottom: Styles.globalMargins.xtiny,
  paddingTop: Styles.globalMargins.xtiny,
}

const ManageChannels = (props: Props) => {
  let channelDisplay
  if (props.channels.length === 0 || props.waitingForGet) {
    channelDisplay = <Kb.ProgressIndicator style={{width: 48}} />
  } else {
    channelDisplay = (
      <Kb.Text
        type="Header"
        style={{marginBottom: Styles.globalMargins.tiny, marginTop: Styles.globalMargins.tiny}}
      >
        {props.channels.length} {pluralize('chat channel', props.channels.length)}
      </Kb.Text>
    )
  }
  return (
    <Kb.PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
      {props.canCreateChannels && (
        <Kb.Box style={_createStyle}>
          <Kb.Icon
            style={_createIcon}
            type="iconfont-new"
            onClick={props.onCreate}
            hoverColor={_hoverColor}
            color={Styles.globalColors.blue}
          />
          <Kb.Text type="BodyBigLink" onClick={props.onCreate}>
            New chat channel
          </Kb.Text>
        </Kb.Box>
      )}
      <Kb.Box style={_boxStyle}>
        <Kb.Avatar isTeam={true} teamname={props.teamname} size={32} />
        <Kb.Text type="BodySmallSemibold" style={{marginTop: Styles.globalMargins.xtiny}}>
          {props.teamname}
        </Kb.Text>
        {channelDisplay}
        <Kb.ScrollView style={{flex: 1, width: '100%'}}>
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
        <Kb.ButtonBar style={{alignSelf: 'flex-end'}}>
          <Kb.Button type="Dim" label="Cancel" onClick={props.onClose} />
          <Kb.WaitingButton
            label={props.unsavedSubscriptions ? 'Save' : 'Saved'}
            waitingKey={props.waitingKey}
            disabled={!props.unsavedSubscriptions}
            onClick={props.onSaveSubscriptions}
            style={{marginLeft: Styles.globalMargins.tiny}}
          />
        </Kb.ButtonBar>
      </Kb.Box>
    </Kb.PopupDialog>
  )
}

const _boxStyle = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  paddingBottom: Styles.globalMargins.medium,
  paddingLeft: Styles.globalMargins.large,
  paddingRight: Styles.globalMargins.large,
  paddingTop: Styles.globalMargins.medium,
}

const _createIcon = Styles.platformStyles({
  common: {marginRight: Styles.globalMargins.xtiny},
  isElectron: {display: 'block'},
})

const _hoverColor = Styles.globalColors.blueLight

const _createStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  position: 'absolute',
  right: 32,
  top: 32,
}

const _styleCover = {
  alignItems: 'center',
  backgroundColor: Styles.globalColors.black_50,
  justifyContent: 'center',
}

const _styleContainer = {
  height: 520,
  width: 620,
}

export default ManageChannels
