import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as ChatConstants from '../../../../constants/chat2'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as TeamConstants from '../../../../constants/teams'
import * as Container from '../../../../util/container'
import {useTeamDetailsSubscribe} from '../../../../teams/subscriber'
import {pluralize} from '../../../../util/string'

type Props = Container.RouteProps<{
  conversationIDKey: ChatTypes.ConversationIDKey
}>

const AddToChannel = (props: Props) => {
  const conversationIDKey = Container.getRouteProps(
    props,
    'conversationIDKey',
    ChatConstants.noConversationIDKey
  )
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const [filter, setFilter] = React.useState('')

  const {channelname, teamname, teamID} = Container.useSelector(s =>
    ChatConstants.getMeta(s, conversationIDKey)
  )
  const participants = Container.useSelector(s => ChatConstants.getParticipantInfo(s, conversationIDKey)).name
  const userInfoMap = Container.useSelector(s => s.users.infoMap)
  const teamDetails = Container.useSelector(s => TeamConstants.getTeamDetails(s, teamID))
  const allMembers = teamDetails.members

  useTeamDetailsSubscribe(teamID)

  const onClose = () => dispatch(nav.safeNavigateUpPayload())

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
        title: title({channelname, teamname}),
      }}
      onClose={onClose}
    >
      <Kb.SearchFilter
        onChange={text => setFilter(text)}
        size="full-width"
        placeholderText={`Search ${allMembers.size} ${pluralize('member', allMembers.size)}`}
        style={styles.filterInput}
      />
    </Kb.Modal>
  )
}

const title = ({channelname, teamname}: {channelname: string; teamname: string}) =>
  Styles.isMobile ? (
    `Add to #${channelname}`
  ) : (
    <Kb.Box2 direction="vertical" gap="xtiny" alignItems="center" style={styles.title}>
      {/* TODO move up 16 */}
      <Kb.Avatar size={32} teamname={teamname} />
      <Kb.Box2 direction="vertical" alignItems="center">
        <Kb.Text type="BodySmall" lineClamp={1}>
          {teamname}
        </Kb.Text>
        <Kb.Text type="Header">Add to #{channelname}</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate(() => ({
  filterInput: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.tiny,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.tiny,
    },
  }),
  title: {
    paddingBottom: Styles.globalMargins.tiny,
  },
}))

export default AddToChannel
