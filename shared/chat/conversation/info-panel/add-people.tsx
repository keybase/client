import * as Chat from '@/stores/chat2'
import {useTeamsState} from '@/stores/teams'
import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  isAdmin: boolean
  isGeneralChannel: boolean
}

const AddPeople = (p: Props) => {
  const {isGeneralChannel, isAdmin} = p
  const teamID = Chat.useChatContext(s => s.meta.teamID)
  const startAddMembersWizard = useTeamsState(s => s.dispatch.startAddMembersWizard)
  const navigateAppend = Chat.useChatNavigateAppend()
  const onAddPeople = React.useCallback(() => {
    startAddMembersWizard(teamID)
  }, [startAddMembersWizard, teamID])
  const onAddToChannel = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({props: {conversationIDKey, teamID}, selected: 'chatAddToChannel'}))
  }, [navigateAppend, teamID])

  let directAction: undefined | (() => void)
  let directLabel: string | undefined
  if (!isGeneralChannel) {
  } else {
    directAction = onAddPeople
    directLabel = 'Add people to team'
  }
  if (!isAdmin) {
    directAction = onAddToChannel
    directLabel = 'Add members to channel'
  }

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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addButtonContainer: {
        alignSelf: undefined,
        marginBottom: Kb.Styles.globalMargins.small,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export default AddPeople
