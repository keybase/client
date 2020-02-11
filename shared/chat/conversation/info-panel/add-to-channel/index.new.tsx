import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as ChatConstants from '../../../../constants/chat2'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as TeamConstants from '../../../../constants/teams'
import * as TeamTypes from '../../../../constants/types/teams'
import * as Container from '../../../../util/container'
import {useTeamDetailsSubscribe} from '../../../../teams/subscriber'
import {pluralize} from '../../../../util/string'
import {memoize} from '../../../../util/memoize'
import {ModalTitle} from '../../../../teams/common'

type Props = Container.RouteProps<{
  conversationIDKey: ChatTypes.ConversationIDKey
}>

const sortMembers = memoize((members: TeamTypes.TeamDetails['members']) =>
  [...members.values()]
    .filter(m => m.type !== 'restrictedbot' && m.type !== 'bot')
    .sort((a, b) => a.username.localeCompare(b.username))
)

const AddToChannel = (props: Props) => {
  const conversationIDKey = Container.getRouteProps(
    props,
    'conversationIDKey',
    ChatConstants.noConversationIDKey
  )
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const [toAdd, setToAdd] = React.useState<Set<string>>(new Set())
  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.toLowerCase()

  const {channelname, teamname, teamID} = Container.useSelector(s =>
    ChatConstants.getMeta(s, conversationIDKey)
  )
  const participants = Container.useSelector(s => ChatConstants.getParticipantInfo(s, conversationIDKey)).all
  const teamDetails = Container.useSelector(s => TeamConstants.getTeamDetails(s, teamID))
  const allMembers = sortMembers(teamDetails.members)
  const membersFiltered = allMembers.filter(
    m => m.username.toLowerCase().includes(filterLCase) || m.fullName.toLowerCase().includes(filterLCase)
  )

  useTeamDetailsSubscribe(teamID)

  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  const onAdd = () => {
    dispatch(Chat2Gen.createAddUsersToChannel({conversationIDKey, usernames: [...toAdd]}))
    onClose()
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
        ) : (
          undefined
        ),
        rightButton: Styles.isMobile && toAdd.size && (
          <Kb.Text type="BodyBigLink" onClick={onAdd}>
            Add
          </Kb.Text>
        ),
        title: title({channelname, teamname}),
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
                  />
                </Kb.Box2>
              ),
            }
      }
      onClose={onClose}
      allowOverflow={true}
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
                    <Kb.ConnectedUsernames
                      type="BodySemibold"
                      colorFollowing={true}
                      usernames={[item.username]}
                    />
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

const title = ({channelname, teamname}: {channelname: string; teamname: string}) =>
  Styles.isMobile ? (
    `Add to #${channelname}`
  ) : (
    <ModalTitle teamname={teamname}>Add to #{channelname}</ModalTitle>
  )

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
