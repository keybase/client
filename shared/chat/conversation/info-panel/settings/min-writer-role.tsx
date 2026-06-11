import * as Kb from '@/common-adapters'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import * as T from '@/constants/types'
import upperFirst from 'lodash/upperFirst'
import {indefiniteArticle} from '@/util/string'
import {useChatTeam} from '../../team-hooks'
import {ignorePromise} from '@/constants/utils'
import {useConversationMeta} from '../../data-hooks'

const positionFallbacks = ['bottom center'] as const

const MinWriterRole = (props: {conversationIDKey: T.Chat.ConversationIDKey}) => {
  const {conversationIDKey} = props
  const meta = useConversationMeta(conversationIDKey)
  const {teamname, minWriterRole} = meta

  const {yourOperations} = useChatTeam(meta.teamID, teamname)
  const canSetMinWriterRole = yourOperations.setMinWriterRole

  const [saving, setSaving] = React.useState(false)
  const [selected, setSelected] = React.useState(minWriterRole)
  const [saveError, setSaveError] = React.useState('')
  const latestSaveIDRef = React.useRef(0)
  const latestMinWriterRoleRef = React.useRef(minWriterRole)

  React.useEffect(() => {
    latestMinWriterRoleRef.current = minWriterRole
  }, [minWriterRole])

  const [lastMinWriterRole, setLastMinWriterRole] = React.useState(minWriterRole)
  let selectedRole = selected
  if (lastMinWriterRole !== minWriterRole) {
    setLastMinWriterRole(minWriterRole)
    selectedRole = minWriterRole
    setSelected(minWriterRole)
  }

  const startSave = () => {
    const saveID = latestSaveIDRef.current + 1
    latestSaveIDRef.current = saveID
    setSaveError('')
    setSaving(true)
    return saveID
  }
  const finishSave = (saveID: number) => {
    if (latestSaveIDRef.current === saveID) {
      setSaving(false)
    }
  }
  const failSave = (saveID: number, error: unknown) => {
    if (latestSaveIDRef.current !== saveID) {
      return
    }
    setSaveError(
      error instanceof Error && error.message ? error.message : 'Failed to save minimum posting role.'
    )
    setSelected(latestMinWriterRoleRef.current)
    setSaving(false)
  }
  const onSetNewRole = (role: T.Teams.TeamRoleType, saveID: number) => {
    const f = async () => {
      try {
        await T.RPCChat.localSetConvMinWriterRoleLocalRpcPromise({
          convID: T.Chat.keyToConversationID(conversationIDKey),
          role: T.RPCGen.TeamRole[role],
        })
        finishSave(saveID)
      } catch (error) {
        failSave(saveID, error)
      }
    }
    ignorePromise(f())
  }
  const selectRole = (role: T.Teams.TeamRoleType) => {
    if (role !== selectedRole) {
      const saveID = startSave()
      setSelected(role)
      onSetNewRole(role, saveID)
    }
  }

  const items = Teams.teamRoleTypes.map(role => ({
    isSelected: role === selectedRole,
    onClick: () => selectRole(role),
    title: upperFirst(role),
  }))

  const saveIndicatorStyle = Kb.Styles.collapseStyles([
    styles.saveIndicator,
    saveError ? styles.hidden : null,
  ])
  return (
    <Kb.Box2 direction="vertical" gap={canSetMinWriterRole ? 'tiny' : 'xxtiny'} fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" alignItems="center">
        <Kb.Text type="BodySmallSemibold">Minimum role to post</Kb.Text>
        {canSetMinWriterRole && <Kb.SaveIndicator saving={saving} style={saveIndicatorStyle} />}
      </Kb.Box2>
      {canSetMinWriterRole ? (
        <Dropdown minWriterRole={selectedRole} items={items} />
      ) : (
        <Display minWriterRole={minWriterRole} />
      )}
      {canSetMinWriterRole && saveError ? (
        <Kb.Banner color="red">
          <Kb.BannerParagraph bannerColor="red" content={saveError} />
        </Kb.Banner>
      ) : null}
    </Kb.Box2>
  )
}

type DropdownProps = {
  minWriterRole: T.Teams.TeamRoleType
  items: Kb.MenuItems
}

const Dropdown = (p: DropdownProps) => {
  const {items, minWriterRole} = p
  const makePopup = (p: Kb.Popup2Parms) => {
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
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.ClickableBox
        direction="horizontal"
        alignItems="center"
        style={styles.dropdown}
        ref={isMobile ? null : popupAnchor}
        onClick={showPopup}
      >
        <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.label}>
          <Kb.Text type="BodySemibold">{upperFirst(minWriterRole)}</Kb.Text>
        </Kb.Box2>
        <Kb.Icon type="iconfont-caret-down" color="inherit" fontSize={7} sizeType="Tiny" />
      </Kb.ClickableBox>
      {popup}
    </>
  )
}

const Display = ({minWriterRole}: {minWriterRole: T.Teams.TeamRoleType}) => (
  <Kb.Text type="BodySmall">
    You must be at least {indefiniteArticle(minWriterRole)}{' '}
    <Kb.Text type="BodySmallSemibold">“{minWriterRole}”</Kb.Text> to post in this channel.
  </Kb.Text>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      dropdown: {
        ...Kb.Styles.border(Kb.Styles.globalColors.grey, 1, Kb.Styles.borderRadius),
        paddingRight: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      hidden: {display: 'none'},
      label: {
        minHeight: isMobile ? 40 : 32,
        paddingLeft: Kb.Styles.globalMargins.xsmall,
      },
      saveIndicator: {height: 17},
    }) as const
)

export default MinWriterRole
