import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useTeamDetailsSubscribe} from '@/teams/subscriber'
import {pluralize} from '@/util/string'
import {useChannelParticipants} from '@/teams/common'
import {useModalHeaderState} from '@/stores/modal-header'

type Props = {teamID: T.Teams.TeamID}

const AddToChannel = (props: Props) => {
  const {teamID} = props
  const nav = useSafeNavigation()
  const conversationIDKey = ConvoState.useChatContext(s => s.id)

  const [toAdd, setToAdd] = React.useState(new Set<string>())
  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.toLowerCase()

  const {channelname} = Teams.useTeamsState(s => Teams.getTeamChannelInfo(s, teamID, conversationIDKey))
  const participants = useChannelParticipants(teamID, conversationIDKey)
  const teamDetails = Teams.useTeamsState(s => s.teamDetails.get(teamID)) ?? Teams.emptyTeamDetails
  const allMembers = [...teamDetails.members.values()]
    .filter(m => m.type !== 'restrictedbot' && m.type !== 'bot')
    .sort((a, b) => a.username.localeCompare(b.username))
  const membersFiltered = allMembers.filter(
    m => m.username.toLowerCase().includes(filterLCase) || m.fullName.toLowerCase().includes(filterLCase)
  )

  useTeamDetailsSubscribe(teamID)

  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const addToChannel = C.useRPC(T.RPCChat.localBulkAddToConvRpcPromise)

  const onClose = () => nav.safeNavigateUp()
  const loadTeamChannelList = Teams.useTeamsState(s => s.dispatch.loadTeamChannelList)
  const onAdd = () => {
    setWaiting(true)
    addToChannel(
      [{convID: T.Chat.keyToConversationID(conversationIDKey), usernames: [...toAdd]}],
      () => {
        setWaiting(false)
        loadTeamChannelList(teamID)
        onClose()
      },
      e => {
        setError(e.message)
        setWaiting(false)
      }
    )
  }

  const loading = !allMembers.length

  React.useEffect(() => {
    const handleAdd = () => {
      setWaiting(true)
      addToChannel(
        [{convID: T.Chat.keyToConversationID(conversationIDKey), usernames: [...toAdd]}],
        () => {
          setWaiting(false)
          loadTeamChannelList(teamID)
          nav.safeNavigateUp()
        },
        (e: {message: string}) => {
          setError(e.message)
          setWaiting(false)
        }
      )
    }
    useModalHeaderState.setState({
      actionEnabled: toAdd.size > 0,
      actionWaiting: waiting,
      onAction: handleAdd,
      title: `Add to #${channelname}`,
    })
    return () => {
      useModalHeaderState.setState({actionEnabled: false, actionWaiting: false, onAction: undefined, title: ''})
    }
  }, [channelname, teamID, toAdd, toAdd.size, waiting, addToChannel, conversationIDKey, loadTeamChannelList, nav])

  return (
    <>
      {error ? (
        <Kb.Banner color="red" key="err">
          {error}
        </Kb.Banner>
      ) : null}
      <Kb.SearchFilter
        onChange={text => setFilter(text)}
        size="full-width"
        placeholderText={
          loading ? 'Loading...' : `Search ${allMembers.length} ${pluralize('member', allMembers.length)}`
        }
        style={styles.filterInput}
      />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
        <Kb.List
          keyProperty="username"
          items={membersFiltered}
          extraData={toAdd}
          renderItem={(idx, item) => {
            const alreadyIn = participants.includes(item.username)
            const onCheck = () => {
              if (toAdd.has(item.username)) {
                toAdd.delete(item.username)
                setToAdd(new Set(toAdd))
              } else {
                toAdd.add(item.username)
                setToAdd(new Set(toAdd))
              }
            }
            return (
              <Kb.ListItem
                firstItem={!Kb.Styles.isMobile || idx === 0}
                icon={<Kb.Avatar size={32} username={item.username} />}
                type="Small"
                onClick={alreadyIn ? undefined : onCheck}
                hideHover={alreadyIn}
                body={
                  <Kb.Box2 direction="vertical" alignItems="flex-start">
                    <Kb.ConnectedUsernames type="BodyBold" colorFollowing={true} usernames={item.username} />
                    <Kb.Text type="BodySmall" lineClamp={1}>
                      {alreadyIn && <Kb.Text type="BodySmall">Already in{!!item.fullName && ' • '}</Kb.Text>}
                      {item.fullName}
                    </Kb.Text>
                  </Kb.Box2>
                }
                action={
                  <Kb.CheckCircle
                    key={idx}
                    onCheck={onCheck}
                    checked={alreadyIn || toAdd.has(item.username)}
                    disabled={alreadyIn}
                    disabledColor={
                      alreadyIn || toAdd.has(item.username)
                        ? Kb.Styles.globalColors.black_20OrWhite_20
                        : undefined
                    }
                    style={styles.checkCircle}
                  />
                }
              />
            )
          }}
          itemHeight={{sizeType: 'Small', type: 'fixedListItemAuto'}}
          style={styles.list}
        />
      </Kb.Box2>
      {Kb.Styles.isMobile ? null : (
        <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
            <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
              <Kb.Button
                type="Dim"
                label="Cancel"
                onClick={onClose}
                style={Kb.Styles.globalStyles.flexOne}
              />
              <Kb.Button
                label={toAdd.size ? `Add ${toAdd.size} ${pluralize('member', toAdd.size)}` : 'Add...'}
                onClick={onAdd}
                disabled={!toAdd.size}
                style={Kb.Styles.globalStyles.flexOne}
                waiting={waiting}
              />
            </Kb.Box2>
        </Kb.Box2>
      )}
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  checkCircle: {
    paddingRight: Kb.Styles.isMobile ? Kb.Styles.globalMargins.small : Kb.Styles.globalMargins.tiny,
  },
  filterInput: Kb.Styles.platformStyles({
    isElectron: {
      marginBottom: Kb.Styles.globalMargins.tiny,
      marginLeft: Kb.Styles.globalMargins.small,
      marginRight: Kb.Styles.globalMargins.small,
      marginTop: Kb.Styles.globalMargins.tiny,
    },
  }),
  list: Kb.Styles.platformStyles({isMobile: {height: '100%'}}),
  listContainer: Kb.Styles.platformStyles({isElectron: {height: 370}}), // shortcut to get the list to expand the modal.
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

export default AddToChannel
