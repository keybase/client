import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import * as TeamsConstants from '../../../constants/teams'
import * as Kb from '../../../common-adapters'
import * as RouterConstants from '../../../constants/router2'
import * as Styles from '../../../styles'
import type * as TeamTypes from '../../../constants/types/teams'
import type * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'

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
      const {attachTo, toggleShowingPopup} = p
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
            onHidden={toggleShowingPopup}
            position="bottom left"
            closeOnSelect={true}
          />
        )
      } else return null
    },
    [isGeneralChannel, onAddPeople, onAddToChannel]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {popup}
      <Kb.Button
        mode="Primary"
        type="Default"
        onClick={directAction || toggleShowingPopup}
        label={directLabel || 'Add people...'}
        ref={popupAnchor}
        style={styles.addButtonContainer}
      />
    </Kb.Box2>
  )
}
_AddPeople.displayName = 'AddPeople'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isAdmin: boolean
  isGeneralChannel: boolean
}

const AddPeople = (ownProps: OwnProps) => {
  const meta = Container.useSelector(state => Constants.getMeta(state, ownProps.conversationIDKey))
  const teamID = meta.teamID
  const startAddMembersWizard = TeamsConstants.useState(s => s.dispatch.startAddMembersWizard)
  const _onAddPeople = (teamID: TeamTypes.TeamID) => {
    startAddMembersWizard(teamID)
  }
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const _onAddToChannel = (conversationIDKey: Types.ConversationIDKey, teamID: TeamTypes.TeamID) => {
    navigateAppend({props: {conversationIDKey, teamID}, selected: 'chatAddToChannel'})
  }
  const props = {
    isAdmin: ownProps.isAdmin,
    isGeneralChannel: ownProps.isGeneralChannel,
    onAddPeople: () => _onAddPeople(teamID),
    onAddToChannel: () => _onAddToChannel(ownProps.conversationIDKey, teamID),
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
