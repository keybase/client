import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useTeamsState} from '@/stores/teams'
import * as React from 'react'
import type * as T from '@/constants/types'
import {ModalTitle} from '@/teams/common'
import {useSafeNavigation} from '@/util/safe-navigation'

type Props = {
  channelname: string
  description: string
  teamID: T.Teams.TeamID
  conversationIDKey: T.Chat.ConversationIDKey
}

const EditChannel = (props: Props) => {
  const teamID = props.teamID
  const conversationIDKey = props.conversationIDKey
  const oldName = props.channelname
  const oldDescription = props.description

  const nav = useSafeNavigation()

  const [name, _setName] = React.useState(oldName)
  const setName = (newName: string) => _setName(newName.replace(/[^a-zA-Z0-9_-]/, ''))

  const [description, setDescription] = React.useState(oldDescription)

  const onBack = () => nav.safeNavigateUp()
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => clearModals()

  const updateChannelName = useTeamsState(s => s.dispatch.updateChannelName)
  const updateTopic = useTeamsState(s => s.dispatch.updateTopic)

  const loadTeamChannelList = useTeamsState(s => s.dispatch.loadTeamChannelList)

  const onSave = () => {
    const ps = [
      ...(oldName !== name ? [updateChannelName(teamID, conversationIDKey, name)] : []),
      ...(oldDescription !== description ? [updateTopic(teamID, conversationIDKey, description)] : []),
    ]
    Promise.all(ps)
      .then(() => {
        nav.safeNavigateUp()
        loadTeamChannelList(teamID)
      })
      .catch(() => {})
  }
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsUpdateChannelName(teamID))

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
          <Kb.Text type="BodySmall">{"You can't edit the #general channel's name."}</Kb.Text>
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  bg: {backgroundColor: Kb.Styles.globalColors.blueGrey},
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  channelNameinput: Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
}))

export default EditChannel
