import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/teams'
import {memoize} from '../../../util/memoize'
import {Section} from '../../../common-adapters/section-list'
import {useTeamDetailsSubscribe} from '../../subscriber'
import {ModalTitle} from '../../common'
import {InviteItem} from './invite-item'

type Props = Container.RouteProps<{teamID: Types.TeamID}>

const splitInviteLinks = memoize((inviteLinks?: Array<Types.InviteLink>): {
  invalid: Array<Types.InviteLink>
  valid: Array<Types.InviteLink>
} => ({
  invalid: [...(inviteLinks || [])].filter(i => !i.isValid),
  valid: [...(inviteLinks || [])].filter(i => i.isValid),
}))

const InviteHistory = (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  useTeamDetailsSubscribe(teamID)
  const teamDetails = Container.useSelector(s => s.teams.teamDetails.get(teamID))
  const loading = !teamDetails
  const [showingValid, setShowingValid] = React.useState(true)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  const onGenerate = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'teamInviteLinksGenerate'}]}))

  const inviteLinks = teamDetails?.inviteLinks
  const {invalid, valid} = splitInviteLinks(inviteLinks)
  const data: Array<Types.InviteLink> = showingValid ? valid : invalid
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

  const validTitle = `Valid (${valid.length})`
  const invalidTitle = `Expired (${invalid.length})`

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
        tabs={[{title: validTitle}, {title: invalidTitle}]}
        onSelect={title => setShowingValid(title === validTitle)}
        selectedTab={showingValid ? validTitle : invalidTitle}
        style={styles.tabs}
      />
      {emptyOrLoading ?? (
        <Kb.BoxGrow>
          <Kb.SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <InviteItem
                inviteLink={item}
                teamID={teamID}
                style={styles.wideMargins}
                showDetails={true}
                showExpireAction={true}
              />
            )}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={true}
          />
        </Kb.BoxGrow>
      )}
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  listContent: {
    paddingBottom: Styles.globalMargins.small,
  },
  tabs: {
    backgroundColor: Styles.globalColors.white,
  },
  wideMargins: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
}))

export default InviteHistory
