import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import {memoize} from '../../../util/memoize'
import {Section} from '../../../common-adapters/section-list'
import {formatDurationLong} from '../../../util/timestamp'
import {useTeamDetailsSubscribe} from '../../subscriber'
import {ModalTitle} from '../../common'

type Props = Container.RouteProps<{teamID: Types.TeamID}>

const splitInviteLinks = memoize((inviteLinks: Set<Types.InviteLink>): {
  active: Array<Types.InviteLink>
  expired: Array<Types.InviteLink>
} => ({active: [...inviteLinks].filter(i => !i.expired), expired: [...inviteLinks].filter(i => i.expired)}))

const InviteHistory = (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  useTeamDetailsSubscribe(teamID)
  const teamDetails = Container.useSelector(s => Constants.getTeamDetails(s, teamID))
  const loading = teamDetails === Constants.emptyTeamDetails // TODO should be a better way to check this
  const [showingExpired, setShowingExpired] = React.useState(false)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  const onGenerate = () => {} // TODO

  const {inviteLinks} = teamDetails
  const {active, expired} = splitInviteLinks(inviteLinks)
  const data: Array<Types.InviteLink> = showingExpired ? expired : active
  const sections: Array<Section<Types.InviteLink>> = [
    {
      data,
      key: 'invites',
    },
  ]

  const emptyOrLoading =
    loading || !data.length ? (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Styles.globalStyles.flexOne}
        centerChildren={true}
      >
        {loading ? (
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" centerChildren={true}>
            <Kb.ProgressIndicator type="Large" />
            <Kb.Text type="BodySmall">Loading...</Kb.Text>
          </Kb.Box2>
        ) : (
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" centerChildren={true}>
            <Kb.Text type="BodySmall">None yet.</Kb.Text>
            <Kb.Button mode="Secondary" label="Generate invite link" onClick={onGenerate} />
          </Kb.Box2>
        )}
      </Kb.Box2>
    ) : null

  const activeTitle = `Valid (${active.length})`
  const expiredTitle = `Expired (${expired.length})`

  return (
    <Kb.Modal
      header={{
        hideBorder: true,
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Close
          </Kb.Text>
        ) : (
          undefined
        ),
        rightButton: Styles.isMobile ? (
          undefined
        ) : (
          <Kb.Button mode="Secondary" label="Generate link" small={true} onClick={onGenerate} />
        ),
        title: <ModalTitle title="Invite links" teamID={teamID} />,
      }}
      footer={{
        content: Styles.isMobile ? (
          <Kb.Button fullWidth={true} mode="Secondary" label="Generate link" onClick={onGenerate} />
        ) : (
          <Kb.Button fullWidth={true} type="Dim" label="Close" onClick={onClose} />
        ),
        hideBorder: Styles.isMobile,
      }}
      onClose={onClose}
      allowOverflow={true}
      mode="DefaultFullHeight"
      noScrollView={true}
    >
      <Kb.Tabs
        tabs={[{title: activeTitle}, {title: expiredTitle}]}
        onSelect={title => setShowingExpired(title === expiredTitle)}
        selectedTab={showingExpired ? expiredTitle : activeTitle}
        style={styles.tabs}
      />
      {emptyOrLoading ?? (
        <Kb.BoxGrow>
          <Kb.SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={({item}) => <InviteItem inviteLink={item} teamID={teamID} />}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={true}
          />
        </Kb.BoxGrow>
      )}
    </Kb.Modal>
  )
}

const InviteItem = React.memo(
  ({inviteLink, teamID}: {inviteLink: Types.InviteLink; teamID: Types.TeamID}) => {
    const dispatch = Container.useDispatch()
    const yourUsername = Container.useSelector(s => s.config.username)
    const onExpire = () => dispatch(TeamsGen.createRemovePendingInvite({inviteID: inviteLink.id, teamID}))

    const duration = formatDurationLong(new Date(), new Date(inviteLink.expirationTime * 1000))
    // TODO Y2K-1715 - when expired we should show how long the invite link was valid for.
    const expireText = inviteLink.expired ? `Expired ${duration} ago` : `Expires in ${duration}`

    return (
      <Kb.Box2 direction="vertical" style={styles.inviteContainer} gap="xtiny">
        <Kb.CopyText text={inviteLink.url} disabled={inviteLink.expired} />
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySmall">
            Invites as {inviteLink.role} • {expireText}
          </Kb.Text>
          <Kb.Text type="BodySmall">
            Created by{' '}
            {inviteLink.creatorUsername === yourUsername ? (
              'you'
            ) : (
              <Kb.ConnectedUsernames
                inline={true}
                colorFollowing={true}
                type="BodySmall"
                usernames={inviteLink.creatorUsername}
              />
            )}{' '}
            • {inviteLink.numUses.toLocaleString()} joined
            {!!inviteLink.lastJoinedUsername && (
              <Kb.Text type="BodySmall">
                , most recently{' '}
                <Kb.ConnectedUsernames
                  inline={true}
                  colorFollowing={true}
                  type="BodySmall"
                  usernames={inviteLink.lastJoinedUsername}
                />
              </Kb.Text>
            )}
          </Kb.Text>
          {!inviteLink.expired && (
            <Kb.Text type="BodySmallPrimaryLink" onClick={onExpire}>
              Expire now
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
)

const styles = Styles.styleSheetCreate(() => ({
  inviteContainer: {
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
    padding: Styles.globalMargins.tiny,
  },
  listContent: {
    paddingBottom: Styles.globalMargins.small,
  },
  tabs: {
    backgroundColor: Styles.globalColors.white,
  },
}))

export default InviteHistory
