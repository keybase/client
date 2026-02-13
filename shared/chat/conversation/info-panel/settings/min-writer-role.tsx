import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import * as Style from '@/styles'
import type * as T from '@/constants/types'
import upperFirst from 'lodash/upperFirst'
import {indefiniteArticle} from '@/util/string'

const positionFallbacks = ['bottom center'] as const

const MinWriterRole = () => {
  const meta = Chat.useChatContext(s => s.meta)
  const {teamname, minWriterRole} = meta

  const canPerform = Teams.useTeamsState(s => (teamname ? Teams.getCanPerform(s, teamname) : undefined))
  const canSetMinWriterRole = canPerform ? canPerform.setMinWriterRole : false

  const [saving, setSaving] = React.useState(false)
  const [selected, setSelected] = React.useState(minWriterRole)
  const setMinWriterRole = Chat.useChatContext(s => s.dispatch.setMinWriterRole)

  const onSetNewRole = (role: T.Teams.TeamRoleType) => setMinWriterRole(role)
  const selectRole = (role: T.Teams.TeamRoleType) => {
    if (role !== minWriterRole) {
      setSaving(true)
      setSelected(role)
      onSetNewRole(role)
    }
  }

  const [lastMinWriterRole, setLastMinWriterRole] = React.useState(minWriterRole)
  const [lastSelected, setLastSelected] = React.useState(selected)

  if (lastSelected !== selected || lastMinWriterRole !== minWriterRole) {
    setLastSelected(selected)
    setLastMinWriterRole(minWriterRole)
    if (minWriterRole !== lastMinWriterRole) {
      setSelected(minWriterRole)
    }
    if (selected === minWriterRole) {
      setSaving(false)
    }
  }

  const items = Teams.teamRoleTypes.map(role => ({
    isSelected: role === minWriterRole,
    onClick: () => selectRole(role),
    title: upperFirst(role),
  }))

  return (
    <Kb.Box2 direction="vertical" gap={canSetMinWriterRole ? 'tiny' : 'xxtiny'} fullWidth={true}>
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

type DropdownProps = {
  minWriterRole: T.Teams.TeamRoleType
  items: Kb.MenuItems
  saving: boolean
}

const Dropdown = (p: DropdownProps) => {
  const {items, minWriterRole, saving} = p
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          visible={true}
          items={items}
          onHidden={hidePopup}
          position="top center"
          positionFallbacks={positionFallbacks}
        />
      )
    },
    [items]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.ClickableBox
        style={styles.dropdown}
        ref={Style.isMobile ? null : popupAnchor}
        onClick={showPopup}
        underlayColor={Style.globalColors.white_40}
      >
        <Kb.Box2 direction="horizontal" style={styles.label}>
          <Kb.Text type="BodySemibold">{upperFirst(minWriterRole)}</Kb.Text>
        </Kb.Box2>
        <Kb.Icon type="iconfont-caret-down" inheritColor={true} fontSize={7} sizeType="Tiny" />
      </Kb.ClickableBox>
      {popup}
      <Kb.SaveIndicator saving={saving} style={styles.saveIndicator} />
    </>
  )
}

const Display = ({minWriterRole}: {minWriterRole: T.Teams.TeamRoleType}) => (
  <Kb.Text type="BodySmall">
    You must be at least {indefiniteArticle(minWriterRole)}{' '}
    <Kb.Text type="BodySmallSemibold">“{minWriterRole}”</Kb.Text> to post in this channel.
  </Kb.Text>
)

const styles = Style.styleSheetCreate(
  () =>
    ({
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
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: Style.isMobile ? 40 : 32,
        paddingLeft: Style.globalMargins.xsmall,
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
    }) as const
)

export default MinWriterRole
