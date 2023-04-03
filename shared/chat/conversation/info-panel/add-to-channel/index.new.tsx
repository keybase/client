import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as ChatConstants from '../../../../constants/chat2'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as TeamConstants from '../../../../constants/teams'
import * as TeamTypes from '../../../../constants/types/teams'
import * as Container from '../../../../util/container'
import * as RPCChatGen from '../../../../constants/types/rpc-chat-gen'
import * as TeamsGen from '../../../../actions/teams-gen'
import {useTeamDetailsSubscribe} from '../../../../teams/subscriber'
import {pluralize} from '../../../../util/string'
import {memoize} from '../../../../util/memoize'
import {ModalTitle, useChannelParticipants} from '../../../../teams/common'

type Props = Container.RouteProps<'chatAddToChannel'>

const sortMembers = memoize((members: TeamTypes.TeamDetails['members']) =>
  [...members.values()]
    .filter(m => m.type !== 'restrictedbot' && m.type !== 'bot')
    .sort((a, b) => a.username.localeCompare(b.username))
)

const AddToChannel = (props: Props) => {
  const conversationIDKey = props.route.params?.conversationIDKey ?? ChatConstants.noConversationIDKey
  const teamID = props.route.params?.teamID ?? TeamTypes.noTeamID
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const [toAdd, setToAdd] = React.useState<Set<string>>(new Set())
  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.toLowerCase()

  const {channelname} = Container.useSelector(s =>
    TeamConstants.getTeamChannelInfo(s, teamID, conversationIDKey)
  )
  const participants = useChannelParticipants(teamID, conversationIDKey)
  const teamDetails = Container.useSelector(s => TeamConstants.getTeamDetails(s, teamID))
  const allMembers = sortMembers(teamDetails.members)
  const membersFiltered = allMembers.filter(
    m => m.username.toLowerCase().includes(filterLCase) || m.fullName.toLowerCase().includes(filterLCase)
  )

  useTeamDetailsSubscribe(teamID)

  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const addToChannel = Container.useRPC(RPCChatGen.localBulkAddToConvRpcPromise)

  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  const onAdd = () => {
    setWaiting(true)
    addToChannel(
      [{convID: ChatTypes.keyToConversationID(conversationIDKey), usernames: [...toAdd]}],
      () => {
        setWaiting(false)
        dispatch(TeamsGen.createLoadTeamChannelList({teamID}))
        onClose()
      },
      e => {
        setError(e.message)
        setWaiting(false)
      }
    )
  }

  const loading = !allMembers.length

  return (
    <Kb.Modal
      header={{
        hideBorder: Styles.isMobile,
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Cancel
          </Kb.Text>
        ) : undefined,
        rightButton: Styles.isMobile && toAdd.size && (
          <Kb.Text type="BodyBigLink" onClick={waiting ? undefined : onAdd}>
            Add
          </Kb.Text>
        ),
        title: title({channelname, teamID}),
      }}
      footer={
        Styles.isMobile
          ? undefined
          : {
              content: (
                <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
                  <Kb.Button
                    type="Dim"
                    label="Cancel"
                    onClick={onClose}
                    style={Styles.globalStyles.flexOne}
                  />
                  <Kb.Button
                    label={toAdd.size ? `Add ${toAdd.size} ${pluralize('member', toAdd.size)}` : 'Add...'}
                    onClick={onAdd}
                    disabled={!toAdd.size}
                    style={Styles.globalStyles.flexOne}
                    waiting={waiting}
                  />
                </Kb.Box2>
              ),
            }
      }
      onClose={onClose}
      allowOverflow={true}
      banners={
        error ? (
          <Kb.Banner color="red" key="err">
            {error}
          </Kb.Banner>
        ) : null
      }
    >
      <Kb.SearchFilter
        onChange={text => setFilter(text)}
        size="full-width"
        placeholderText={
          loading ? 'Loading...' : `Search ${allMembers.length} ${pluralize('member', allMembers.length)}`
        }
        style={styles.filterInput}
      />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
        <Kb.List2
          items={membersFiltered}
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
              <Kb.ListItem2
                firstItem={!Styles.isMobile || idx === 0}
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
                        ? Styles.globalColors.black_20OrWhite_20
                        : undefined
                    }
                    style={styles.checkCircle}
                  />
                }
              />
            )
          }}
          itemHeight={{sizeType: 'Small', type: 'fixedListItem2Auto'}}
          style={styles.list}
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const title = ({channelname, teamID}: {channelname: string; teamID: TeamTypes.TeamID}) =>
  Styles.isMobile ? `Add to #${channelname}` : <ModalTitle teamID={teamID} title={`Add to #${channelname}`} />

const styles = Styles.styleSheetCreate(() => ({
  checkCircle: {paddingRight: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.tiny},
  filterInput: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.tiny,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.tiny,
    },
  }),
  list: Styles.platformStyles({isMobile: {height: '100%'}}),
  listContainer: Styles.platformStyles({isElectron: {height: 370}}), // shortcut to get the list to expand the modal.
}))

export default AddToChannel
