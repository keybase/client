import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import {pluralize} from '@/util/string'
import {useModalHeaderState} from '@/stores/modal-header'
import {useChatTeamMembers} from '../team-hooks'

type Props = {teamID: T.Teams.TeamID}

const AddToChannel = (props: Props) => {
  const {teamID} = props
  const nav = useSafeNavigation()
  const {channelname, conversationIDKey} = ConvoState.useChatContext(
    C.useShallow(s => ({
      channelname: s.meta.channelname,
      conversationIDKey: s.id,
    }))
  )

  const [toAdd, setToAdd] = React.useState(new Set<string>())
  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.toLowerCase()

  const participants = ConvoState.useChatContext(s => s.participants.all)
  const {loading: loadingMembers, members: teamMembers} = useChatTeamMembers(teamID)
  const allMembers = [...teamMembers.values()]
    .filter(m => m.type !== 'restrictedbot' && m.type !== 'bot')
    .sort((a, b) => a.username.localeCompare(b.username))
  const membersFiltered = allMembers.filter(
    m => m.username.toLowerCase().includes(filterLCase) || m.fullName.toLowerCase().includes(filterLCase)
  )

  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const addToChannel = C.useRPC(T.RPCChat.localBulkAddToConvRpcPromise)

  const onClose = () => nav.safeNavigateUp()
  const onAdd = React.useCallback(() => {
    setWaiting(true)
    addToChannel(
      [{convID: T.Chat.keyToConversationID(conversationIDKey), usernames: [...toAdd]}],
      () => {
        setWaiting(false)
        onClose()
      },
      e => {
        setError(e.message)
        setWaiting(false)
      }
    )
  }, [addToChannel, conversationIDKey, onClose, toAdd])

  const loading = loadingMembers && !allMembers.length

  React.useEffect(() => {
    useModalHeaderState.setState({
      actionEnabled: toAdd.size > 0,
      actionWaiting: waiting,
      onAction: onAdd,
      title: `Add to #${channelname}`,
    })
    return () => {
      useModalHeaderState.setState({
        actionEnabled: false,
        actionWaiting: false,
        onAction: undefined,
        title: '',
      })
    }
  }, [
    channelname,
    toAdd.size,
    waiting,
    onAdd,
  ])

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
            <Kb.Button type="Dim" label="Cancel" onClick={onClose} style={Kb.Styles.globalStyles.flexOne} />
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
