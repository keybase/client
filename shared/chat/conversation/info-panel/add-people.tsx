import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'
import type * as T from '@/constants/types'

type Props = {
  isAdmin: boolean
  isGeneralChannel: boolean
  onAddPeople: () => void
  onAddToChannel: () => void
}

const _AddPeople = (props: Props) => {
  let directAction: undefined | (() => void)
  let directLabel: string | undefined
  if (!props.isGeneralChannel) {
  } else {
    directAction = props.onAddPeople
    directLabel = 'Add people to team'
  }
  if (!props.isAdmin) {
    directAction = props.onAddToChannel
    directLabel = 'Add members to channel'
  }
  const {isGeneralChannel, onAddToChannel, onAddPeople} = props

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      if (!isGeneralChannel) {
        // general channel & small teams don't need a menu
        const items: Kb.MenuItems = [
          {icon: 'iconfont-people', onClick: onAddPeople, title: 'To team'},
          {icon: 'iconfont-hash', onClick: onAddToChannel, title: 'To channel'},
        ]
        return (
          <Kb.FloatingMenu
            attachTo={attachTo}
            visible={true}
            items={items}
            onHidden={hidePopup}
            position="bottom left"
            closeOnSelect={true}
          />
        )
      } else return null
    },
    [isGeneralChannel, onAddPeople, onAddToChannel]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {popup}
      <Kb.Button
        mode="Primary"
        type="Default"
        onClick={directAction || showPopup}
        label={directLabel || 'Add people...'}
        ref={popupAnchor}
        style={styles.addButtonContainer}
      />
    </Kb.Box2>
  )
}
_AddPeople.displayName = 'AddPeople'

type OwnProps = {
  isAdmin: boolean
  isGeneralChannel: boolean
}

const AddPeople = (ownProps: OwnProps) => {
  const meta = C.useChatContext(s => s.meta)
  const teamID = meta.teamID
  const startAddMembersWizard = C.useTeamsState(s => s.dispatch.startAddMembersWizard)
  const _onAddPeople = (teamID: T.Teams.TeamID) => {
    startAddMembersWizard(teamID)
  }
  const navigateAppend = C.Chat.useChatNavigateAppend()
  const _onAddToChannel = (teamID: T.Teams.TeamID) => {
    navigateAppend(conversationIDKey => ({props: {conversationIDKey, teamID}, selected: 'chatAddToChannel'}))
  }
  const props = {
    isAdmin: ownProps.isAdmin,
    isGeneralChannel: ownProps.isGeneralChannel,
    onAddPeople: () => _onAddPeople(teamID),
    onAddToChannel: () => _onAddToChannel(teamID),
  }
  return <_AddPeople {...props} />
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addButtonContainer: {
        alignSelf: undefined,
        marginBottom: Styles.globalMargins.small,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
      },
    }) as const
)

export default AddPeople
