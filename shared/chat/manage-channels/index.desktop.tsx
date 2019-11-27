import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props, RowProps} from './index'
import {pluralize} from '../../util/string'

const HoverBox = Styles.styled(Kb.Box)(() => ({
  '.channel-row:hover &': {opacity: 1},
  opacity: 0,
}))

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
  if (!props.isFiltered && (props.channels.length === 0 || props.waitingForGet)) {
    channelDisplay = <Kb.ProgressIndicator type="Large" style={styles.progressIndicator} />
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
    <Kb.PopupDialog onClose={props.onClose} styleCover={styles.cover} styleContainer={styles.container}>
      {props.canCreateChannels && (
        <Kb.Box style={styles.create}>
          <Kb.Icon
            style={styles.createIcon}
            type="iconfont-new"
            onClick={props.onCreate}
            hoverColor={Styles.globalColors.blueLight}
            color={Styles.globalColors.blue}
          />
          <Kb.Text type="BodyBigLink" onClick={props.onCreate}>
            New chat channel
          </Kb.Text>
        </Kb.Box>
      )}
      <Kb.Box style={styles.box}>
        <Kb.Avatar isTeam={true} teamname={props.teamname} size={32} />
        <Kb.Text type="BodySmallSemibold" style={{marginTop: Styles.globalMargins.xtiny}}>
          {props.teamname}
        </Kb.Text>
        {channelDisplay}
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchBox}>
          <Kb.SearchFilter
            size="full-width"
            icon="iconfont-search"
            placeholderText={`Search channels in ${props.teamname}`}
            placeholderCentered={true}
            mobileCancelButton={true}
            hotkey="f"
            onChange={props.onChangeSearch}
          />
        </Kb.Box2>
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

const styles = Styles.styleSheetCreate(() => ({
  box: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    height: '100%',
    paddingBottom: Styles.globalMargins.medium,
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
    paddingTop: Styles.globalMargins.medium,
  },
  container: {
    height: 520,
    width: 620,
  },
  cover: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.black_50OrBlack_60,
    justifyContent: 'center',
  },
  create: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    position: 'absolute',
    right: 32,
    top: 32,
  },
  createIcon: Styles.platformStyles({
    common: {marginRight: Styles.globalMargins.xtiny},
    isElectron: {display: 'block'},
  }),
  progressIndicator: {
    margin: Styles.globalMargins.xtiny,
    width: 48,
  },
  searchBox: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
}))

export default ManageChannels
