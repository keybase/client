import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Kb from '../../../../common-adapters'
import * as TeamTypes from '../../../../constants/types/teams'
import * as TeamConstants from '../../../../constants/teams'
import * as Style from '../../../../styles'
import upperFirst from 'lodash/upperFirst'
import {indefiniteArticle} from '../../../../util/string'

type Props = {conversationIDKey: Types.ConversationIDKey}

const MinWriterRole = (props: Props) => {
  const {conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {teamname} = meta

  const canPerform = Container.useSelector(state =>
    teamname ? TeamConstants.getCanPerform(state, teamname) : undefined
  )
  const canSetMinWriterRole = canPerform ? canPerform.setMinWriterRole : false
  const minWriterRole = meta.minWriterRole ?? 'reader'

  const [saving, setSaving] = React.useState(false)
  const [selected, setSelected] = React.useState(minWriterRole)

  const onSetNewRole = (role: TeamTypes.TeamRoleType) =>
    dispatch(Chat2Gen.createSetMinWriterRole({conversationIDKey, role}))
  const selectRole = (role: TeamTypes.TeamRoleType) => {
    if (role !== minWriterRole) {
      setSaving(true)
      setSelected(role)
      onSetNewRole(role)
    }
  }

  const lastMinWriterRole = Container.usePrevious(minWriterRole)

  React.useEffect(() => {
    if (minWriterRole !== lastMinWriterRole) {
      setSelected(minWriterRole)
    }
    if (selected === minWriterRole) {
      setSaving(false)
    }
  }, [lastMinWriterRole, minWriterRole, selected])

  const items = TeamConstants.teamRoleTypes.map(role => ({
    onClick: () => selectRole(role),
    title: upperFirst(role),
  }))

  return (
    <Kb.Box2
      direction="vertical"
      gap={canSetMinWriterRole ? 'tiny' : 'xxtiny'}
      fullWidth={true}
      style={styles.container}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
        <Kb.Text type="BodySmallSemibold">Minimum role to post</Kb.Text>
      </Kb.Box2>
      {canSetMinWriterRole ? (
        <Dropdown minWriterRole={selected} items={items} saving={saving} />
      ) : (
        <Display minWriterRole={minWriterRole} />
      )}
    </Kb.Box2>
  )
}

type DropdownProps = Kb.OverlayParentProps & {
  minWriterRole: TeamTypes.TeamRoleType
  items: Kb.MenuItems
  saving: boolean
}

const _Dropdown = ({
  getAttachmentRef,
  items,
  minWriterRole,
  saving,
  setAttachmentRef,
  showingMenu,
  toggleShowingMenu,
}: DropdownProps) => (
  <>
    <Kb.ClickableBox
      style={styles.dropdown}
      ref={Style.isMobile ? null : setAttachmentRef}
      onClick={toggleShowingMenu}
      underlayColor={Style.globalColors.white_40}
    >
      <Kb.Box2 direction="horizontal" style={styles.label}>
        <Kb.Text type="BodySemibold">{upperFirst(minWriterRole)}</Kb.Text>
      </Kb.Box2>
      <Kb.Icon type="iconfont-caret-down" inheritColor={true} fontSize={7} sizeType="Tiny" />
    </Kb.ClickableBox>
    <Kb.FloatingMenu
      attachTo={getAttachmentRef}
      closeOnSelect={true}
      visible={showingMenu}
      items={items}
      onHidden={toggleShowingMenu}
      position="top center"
      positionFallbacks={['bottom center']}
    />
    <Kb.SaveIndicator
      saving={saving}
      style={styles.saveIndicator}
      minSavingTimeMs={300}
      savedTimeoutMs={2500}
    />
  </>
)
const Dropdown = Kb.OverlayParentHOC(_Dropdown)

const Display = ({minWriterRole}: {minWriterRole: TeamTypes.TeamRoleType}) => (
  <Kb.Text type="BodySmall">
    You must be at least {indefiniteArticle(minWriterRole)}{' '}
    <Kb.Text type="BodySmallSemibold">“{minWriterRole}”</Kb.Text> to post in this channel.
  </Kb.Text>
)

const styles = Style.styleSheetCreate(
  () =>
    ({
      container: {
        paddingLeft: Style.globalMargins.small,
        paddingRight: Style.globalMargins.small,
      },
      dropdown: Style.platformStyles({
        common: {
          ...Style.globalStyles.flexBoxRow,
          alignItems: 'center',
          borderColor: Style.globalColors.grey,
          borderRadius: Style.borderRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          minWidth: 220,
          paddingRight: Style.globalMargins.small,
        },
        isElectron: {
          marginRight: 45 - 16,
          width: 'auto',
        },
      }),
      label: {
        ...Style.globalStyles.flexBoxCenter,
        minHeight: Style.isMobile ? 40 : 32,
        width: '100%',
      },
      saveIndicator: Style.platformStyles({
        common: {
          ...Style.globalStyles.flexBoxRow,
          alignItems: 'center',
          height: 17,
          justifyContent: 'center',
          marginTop: Style.globalMargins.tiny,
        },
        isMobile: {
          height: Style.globalMargins.medium,
        },
      }),
    } as const)
)

export default MinWriterRole
