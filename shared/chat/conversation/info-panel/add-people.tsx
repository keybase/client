import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'

type Props = {
  isAdmin: boolean
  isGeneralChannel: boolean
}

const AddPeople = (p: Props) => {
  const {isGeneralChannel, isAdmin} = p
  const teamID = ConvoState.useChatContext(s => s.meta.teamID)
  const navigateAppend = ConvoState.useChatNavigateAppend()
  const onAddPeople = () => {
    teamID && C.Router2.navigateAppend({name: 'teamAddToTeamFromWhere', params: {teamID}})
  }
  const onAddToChannel = () => {
    navigateAppend(conversationIDKey => ({name: 'chatAddToChannel', params: {conversationIDKey, teamID}}))
  }

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
