import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import type * as T from '@/constants/types'
import {useTeamDetailsSubscribe} from '@/teams/subscriber'
import {ModalTitle} from '@/teams/common'
import {InviteItem} from './invite-item'
import type {Section} from '@/common-adapters/section-list'

type Props = {teamID: T.Teams.TeamID}

const InviteHistory = (props: Props) => {
  const teamID = props.teamID
  useTeamDetailsSubscribe(teamID)
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID))
  const loading = !teamDetails
  const [showingValid, setShowingValid] = React.useState(true)
  const nav = Container.useSafeNavigation()
  const onClose = () => nav.safeNavigateUp()
  const onGenerate = () => nav.safeNavigateAppend({props: {teamID}, selected: 'teamInviteLinksGenerate'})
  const inviteLinks = teamDetails?.inviteLinks
  const invalid = inviteLinks?.filter(i => !i.isValid) ?? []
  const valid = inviteLinks?.filter(i => i.isValid) ?? []
  const data: Array<T.Teams.InviteLink> = showingValid ? valid : invalid
  const sections: Array<Section<T.Teams.InviteLink>> = [
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
        style={Kb.Styles.globalStyles.flexOne}
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
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Close
          </Kb.Text>
        ) : undefined,
        rightButton: Kb.Styles.isMobile ? undefined : (
          <Kb.Button mode="Secondary" label="Generate link" small={true} onClick={onGenerate} />
        ),
        title: <ModalTitle title="Invite links" teamID={teamID} />,
      }}
      footer={{
        content: Kb.Styles.isMobile ? (
          <Kb.Button fullWidth={true} mode="Secondary" label="Generate link" onClick={onGenerate} />
        ) : (
          <Kb.Button fullWidth={true} type="Dim" label="Close" onClick={onClose} />
        ),
        hideBorder: Kb.Styles.isMobile,
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  listContent: {
    paddingBottom: Kb.Styles.globalMargins.small,
  },
  tabs: {
    backgroundColor: Kb.Styles.globalColors.white,
  },
  wideMargins: {
    marginLeft: Kb.Styles.globalMargins.small,
    marginRight: Kb.Styles.globalMargins.small,
    marginTop: Kb.Styles.globalMargins.small,
  },
}))

export default InviteHistory
