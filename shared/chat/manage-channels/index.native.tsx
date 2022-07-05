import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props, RowProps} from './index'
import {pluralize} from '../../util/string'

const Edit = ({onClick, style}: {onClick: () => void; style: Object}) => (
  <Kb.ClickableBox style={style} onClick={onClick}>
    <Kb.Icon style={{marginRight: Styles.globalMargins.xtiny}} type="iconfont-edit" sizeType="Small" />
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
    <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, flex: 1, position: 'relative'}}>
      <Kb.Text
        type="BodySemiboldLink"
        onClick={props.onClickChannel}
        style={{color: Styles.globalColors.blueDark, maxWidth: '100%'}}
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
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
        onClick={props.onEdit}
      />
    )}
  </Kb.Box>
)

const _rowBox = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  paddingBottom: Styles.globalMargins.small,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
  width: '100%',
}

const ManageChannels = (props: Props) => (
  <Kb.Box style={styles.box}>
    <Kb.Box2 direction="horizontal" fullWidth={true}>
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
    <Kb.ScrollView style={{alignSelf: 'flex-start', width: '100%'}}>
      {props.canCreateChannels && (
        <Kb.Box style={styles.create}>
          <Kb.Icon
            style={styles.createIcon}
            type="iconfont-new"
            onClick={props.onCreate}
            color={Styles.globalColors.blue}
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
    <Kb.Box style={styles.waitingBox}>
      <Kb.Box style={{...Styles.globalStyles.flexBoxRow, justifyContent: 'center'}}>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      box: {
        ...Styles.globalStyles.flexBoxColumn,
        backgroundColor: Styles.globalColors.white,
        height: '100%',
        width: '100%',
      },
      create: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        alignSelf: 'stretch',
        height: 56,
        justifyContent: 'center',
      },
      createIcon: {
        marginRight: Styles.globalMargins.xtiny,
      },
      waitingBox: {
        borderStyle: 'solid',
        borderTopColor: Styles.globalColors.black_10,
        borderTopWidth: 1,
        ...Styles.globalStyles.flexBoxColumn,
        justifyContent: 'flex-end',
        padding: Styles.globalMargins.small,
      },
    } as const)
)

const Wrapper = (p: Props) => (
  <Kb.HeaderHocWrapper onBack={p.onBack}>
    <ManageChannels {...p} onClose={undefined} />
  </Kb.HeaderHocWrapper>
)

export default Wrapper
