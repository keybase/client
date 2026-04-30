import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {makeAddMembersWizard} from '@/teams/add-members-wizard/state'

type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  isAdmin: boolean
  isGeneralChannel: boolean
  teamID: T.Teams.TeamID
}

const AddPeople = (p: Props) => {
  const {conversationIDKey, isGeneralChannel, isAdmin, teamID} = p
  const onAddPeople = () => {
    if (teamID) {
      C.Router2.navigateAppend({name: 'teamAddToTeamFromWhere', params: {wizard: makeAddMembersWizard(teamID)}})
    }
  }
  const onAddToChannel = () => {
    C.Router2.navigateAppend({name: 'chatAddToChannel', params: {conversationIDKey, teamID}})
  }

  let directAction: undefined | (() => void)
  let directLabel: string | undefined
  if (isGeneralChannel) {
    directAction = onAddPeople
    directLabel = 'Add people to team'
  }
  if (!isAdmin) {
    directAction = onAddToChannel
    directLabel = 'Add members to channel'
  }

  const makePopup = (p: Kb.Popup2Parms) => {
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
  }
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
