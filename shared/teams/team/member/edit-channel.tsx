import type * as ChatTypes from '../../../constants/types/chat2'
import * as Constants from '../../../constants/teams'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Types from '../../../constants/types/teams'
import {ModalTitle} from '../../common'
import {useEditState} from './use-edit'

type Props = {
  channelname: string
  description: string
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
}

const EditChannel = (props: Props) => {
  const teamID = props.teamID ?? Types.noTeamID
  const conversationIDKey = props.conversationIDKey
  const oldName = props.channelname
  const oldDescription = props.description

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const [name, _setName] = React.useState(oldName)
  const setName = (newName: string) => _setName(newName.replace(/[^a-zA-Z0-9_-]/, ''))

  const [description, setDescription] = React.useState(oldDescription)

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onClose = () => dispatch(RouteTreeGen.createClearModals())

  const onSave = () => {
    if (oldName !== name) {
      dispatch(TeamsGen.createUpdateChannelName({conversationIDKey, newChannelName: name, teamID}))
    }
    if (oldDescription !== description) {
      dispatch(TeamsGen.createUpdateTopic({conversationIDKey, newTopic: description, teamID}))
    }
  }
  const waiting = Container.useAnyWaiting(Constants.updateChannelNameWaitingKey(teamID))
  const wasWaiting = Container.usePrevious(waiting)

  const triggerEditUpdated = useEditState(s => s.triggerEditUpdated)

  React.useEffect(() => {
    if (wasWaiting && !waiting) {
      dispatch(nav.safeNavigateUpPayload())
      dispatch(TeamsGen.createLoadTeamChannelList({teamID}))
      triggerEditUpdated()
    }
  }, [dispatch, nav, waiting, wasWaiting, triggerEditUpdated, teamID])

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onClose}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamID={teamID} title={`#${oldName}`} />,
      }}
      footer={{
        content: (
          <Kb.Button
            label="Save"
            onClick={onSave}
            fullWidth={true}
            disabled={oldName === name && description === oldDescription}
            waiting={waiting}
          />
        ),
      }}
      allowOverflow={true}
      backgroundStyle={styles.bg}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.body} gap="tiny">
        <Kb.NewInput
          autoFocus={true}
          maxLength={16}
          onChangeText={setName}
          prefix={`#`}
          placeholder="channelname"
          value={name}
          disabled={oldName === 'general'}
          containerStyle={styles.channelNameinput}
        />
        {oldName === 'general' && (
          <Kb.Text type="BodySmall">You can't edit the #general channel's name.</Kb.Text>
        )}
        <Kb.LabeledInput
          hoverPlaceholder="What is this channel about?"
          placeholder="Description"
          value={description}
          rowsMin={3}
          rowsMax={3}
          multiline={true}
          onChangeText={setDescription}
          maxLength={280}
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  bg: {backgroundColor: Styles.globalColors.blueGrey},
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  channelNameinput: Styles.padding(Styles.globalMargins.tiny),
}))

export default EditChannel
