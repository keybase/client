import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useLoadedTeam} from '../use-loaded-team'

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
  const {
    teamMeta: {teamname},
  } = useLoadedTeam(teamID)

  const [name, _setName] = React.useState(oldName)
  const setName = (newName: string) => _setName(newName.replace(/[^a-zA-Z0-9_-]/, ''))

  const [description, setDescription] = React.useState(oldDescription)
  const updateChannelNameRPC = C.useRPC(T.RPCChat.localPostMetadataRpcPromise)
  const updateTopicRPC = C.useRPC(T.RPCChat.localPostHeadlineRpcPromise)
  const waitingKey = C.waitingKeyTeamsUpdateChannelName(teamID)

  const updateChannelName = async (newChannelName: string) =>
    await new Promise<void>((resolve, reject) => {
      updateChannelNameRPC(
        [
          {
            channelName: newChannelName,
            conversationID: T.Chat.keyToConversationID(conversationIDKey),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            tlfName: teamname,
            tlfPublic: false,
          },
          waitingKey,
        ],
        () => resolve(),
        reject
      )
    })
  const updateTopic = async (newTopic: string) =>
    await new Promise<void>((resolve, reject) => {
      updateTopicRPC(
        [
          {
            conversationID: T.Chat.keyToConversationID(conversationIDKey),
            headline: newTopic,
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            tlfName: teamname,
            tlfPublic: false,
          },
          waitingKey,
        ],
        () => resolve(),
        reject
      )
    })

  const onSave = () => {
    const ps = [
      ...(oldName !== name ? [updateChannelName(name)] : []),
      ...(oldDescription !== description ? [updateTopic(description)] : []),
    ]
    Promise.all(ps)
      .then(() => {
        nav.safeNavigateUp()
      })
      .catch(() => {})
  }
  const waiting = C.Waiting.useAnyWaiting(waitingKey)

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.body} gap="tiny">
        <Kb.Input3
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
        <Kb.Input3
          placeholder="Description"
          value={description}
          rowsMin={3}
          rowsMax={3}
          multiline={true}
          onChangeText={setDescription}
          maxLength={280}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
        <Kb.Button
          label="Save"
          onClick={onSave}
          fullWidth={true}
          disabled={oldName === name && description === oldDescription}
          waiting={waiting}
        />
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  channelNameinput: Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
}))

export default EditChannel
