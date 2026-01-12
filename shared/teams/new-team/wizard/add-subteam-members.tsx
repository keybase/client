import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {ModalTitle} from '@/teams/common'
import {pluralize} from '@/util/string'
import {useTeamDetailsSubscribe} from '@/teams/subscriber'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useCurrentUserState} from '@/stores/current-user'

const AddSubteamMembers = () => {
  const nav = useSafeNavigation()
  const [selectedMembers, setSelectedMembers] = React.useState(new Set<string>())
  const [filter, setFilter] = React.useState('')
  const filterL = filter.toLowerCase()
  const onBack = () => nav.safeNavigateUp()
  const setTeamWizardSubteamMembers = Teams.useTeamsState(s => s.dispatch.setTeamWizardSubteamMembers)
  const startAddMembersWizard = Teams.useTeamsState(s => s.dispatch.startAddMembersWizard)
  const onContinue = () =>
    selectedMembers.size
      ? setTeamWizardSubteamMembers([...selectedMembers])
      : startAddMembersWizard(T.Teams.newTeamWizardTeamID)

  const yourUsername = useCurrentUserState(s => s.username)
  const parentTeamID = Teams.useTeamsState(s => s.newTeamWizard.parentTeamID ?? T.Teams.noTeamID)
  useTeamDetailsSubscribe(parentTeamID)
  const parentTeamName = Teams.useTeamsState(s => Teams.getTeamMeta(s, parentTeamID).teamname)
  const parentMembersMap = Teams.useTeamsState(
    s => (s.teamDetails.get(parentTeamID) ?? Teams.emptyTeamDetails).members
  )
  const parentMembers = [...parentMembersMap.values()].filter(
    m => !Teams.isBot(m.type) && m.username !== yourUsername
  )
  const filteredMembers = filter
    ? parentMembers.filter(
        m => m.username.toLowerCase().includes(filterL) || m.fullName.toLowerCase().includes(filterL)
      )
    : parentMembers
  const allSelected = parentMembers.length === selectedMembers.size
  const onSelectAll = () => setSelectedMembers(new Set(parentMembers.map(m => m.username)))
  const onSelectNone = () => setSelectedMembers(new Set())

  const continueLabel = selectedMembers.size
    ? `Continue with ${selectedMembers.size} ${pluralize('member', selectedMembers.size)}`
    : 'Continue without members'
  const doneLabel = selectedMembers.size ? 'Done' : 'Skip'

  const renderItem = (_: number, m: T.Teams.MemberInfo) => {
    const selected = selectedMembers.has(m.username)
    const onSelect = () => {
      // TODO: ensure performance (see Y2K-1666)
      !selected ? selectedMembers.add(m.username) : selectedMembers.delete(m.username)
      setSelectedMembers(new Set([...selectedMembers]))
    }

    return (
      <Kb.ListItem2
        type="Small"
        icon={<Kb.Avatar username={m.username} size={32} />}
        body={
          <Kb.Box2 direction="vertical">
            <Kb.ConnectedUsernames type="BodySemibold" usernames={[m.username]} />
            <Kb.Text type="BodySmall" lineClamp={1}>
              {m.fullName}
            </Kb.Text>
          </Kb.Box2>
        }
        action={<Kb.CheckCircle checked={selectedMembers.has(m.username)} onCheck={onSelect} />}
        firstItem={true}
        key={m.username}
        onClick={() => onSelect()}
      />
    )
  }
  return (
    <Kb.Modal
      allowOverflow={true}
      mode="DefaultFullHeight"
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        rightButton: Kb.Styles.isMobile ? (
          <Kb.Box2 direction="horizontal" style={styles.noWrap}>
            <Kb.Text type="BodyBigLink" onClick={onContinue}>
              {doneLabel}
            </Kb.Text>
          </Kb.Box2>
        ) : undefined,
        title: <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Add members" />,
      }}
      footer={
        Kb.Styles.isMobile
          ? undefined
          : {
              content: <Kb.Button label={continueLabel} onClick={onContinue} fullWidth={true} />,
            }
      }
      noScrollView={true}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.hideOverflow}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchContainer}>
          <Kb.SearchFilter
            size="full-width"
            onChange={setFilter}
            value={filter}
            placeholderText={`Search ${parentMembers.length} members`}
            icon="iconfont-search"
            style={styles.search}
          />
        </Kb.Box2>
        {/* TODO: once it's easier to make a single different-height header, make this part of the list2 */}
        <Kb.Box2 direction="horizontal" style={styles.header} fullWidth={true}>
          <Kb.Text type="BodySmallSemibold" lineClamp={1} style={styles.flexShrink}>
            Members of {parentTeamName}
          </Kb.Text>
          <Kb.Text type="BodyPrimaryLink" onClick={allSelected ? onSelectNone : onSelectAll}>
            Select {allSelected ? 'none' : 'all'}
          </Kb.Text>
        </Kb.Box2>
        <Kb.BoxGrow>
          <Kb.List2
            items={filteredMembers}
            renderItem={renderItem}
            itemHeight={{sizeType: 'Small', type: 'fixedListItem2Auto'}}
          />
        </Kb.BoxGrow>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  flexShrink: {flexShrink: 1},
  header: {
    alignItems: 'center',
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    height: Kb.Styles.globalMargins.mediumLarge,
    justifyContent: 'space-between',
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingRight: Kb.Styles.globalMargins.small,
  },
  hideOverflow: {overflow: 'hidden'},
  noWrap: {
    justifyContent: 'flex-end',
    width: 48, // wide enough for "Done" or "Skip" to fit. workaround modal2 header measurement onmount
  },
  search: {
    borderRadius: 4,
  },
  searchContainer: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
}))

export default AddSubteamMembers
