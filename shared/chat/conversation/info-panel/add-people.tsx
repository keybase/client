import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import * as Kb from '../../../common-adapters'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
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
  let directAction: null | (() => void) = null
  let directLabel: string | null = null
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

  const dispatch = Container.useDispatch()

  const _onAddPeople = (teamID: TeamTypes.TeamID) => {
    dispatch(TeamsGen.createStartAddMembersWizard({teamID}))
  }
  const _onAddToChannel = (conversationIDKey: Types.ConversationIDKey, teamID: TeamTypes.TeamID) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey, teamID}, selected: 'chatAddToChannel'}],
      })
    )
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
    } as const)
)

export default AddPeople
