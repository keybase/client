import * as Teams from '@/constants/teams'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import {useCurrentUserState} from '@/stores/current-user'
import {useModalHeaderState} from '@/stores/modal-header'
import * as C from '@/constants'
import {newTeamWizardToAddMembersWizard, type NewTeamWizard} from './state'
import {useNavigation} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'

type Props = {
  wizard: NewTeamWizard
}

type TeamWizardSubteamMembersParamList = {
  teamWizardSubteamMembers: {wizard: NewTeamWizard}
}

const AddSubteamMembers = ({wizard: wizardState}: Props) => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<TeamWizardSubteamMembersParamList, 'teamWizardSubteamMembers'>
    >()
  const [selectedMembers, setSelectedMembers] = React.useState(new Set<string>())
  const [filter, setFilter] = React.useState('')
  const filterL = filter.toLowerCase()
  const navigateAppend = C.Router2.navigateAppend
  const onContinue = React.useCallback(() => {
    const wizard = newTeamWizardToAddMembersWizard(wizardState, {
      addingMembers: [...selectedMembers].map(assertion => ({assertion, role: 'writer'})),
    })
    navigation.setParams({wizard: wizardState})
    navigateAppend({
      name: selectedMembers.size ? 'teamAddToTeamConfirm' : 'teamAddToTeamFromWhere',
      params: {wizard},
    })
  }, [navigateAppend, navigation, selectedMembers, wizardState])

  const yourUsername = useCurrentUserState(s => s.username)
  const parentTeamID = wizardState.parentTeamID ?? T.Teams.noTeamID
  const {
    teamDetails: {members: parentMembersMap},
    teamMeta: {teamname: parentTeamName},
  } = useLoadedTeam(parentTeamID)
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
      if (!selected) {
        selectedMembers.add(m.username)
      } else {
        selectedMembers.delete(m.username)
      }
      setSelectedMembers(new Set([...selectedMembers]))
    }

    return (
      <Kb.ListItem
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

  React.useEffect(() => {
    useModalHeaderState.setState({
      actionEnabled: true,
      onAction: onContinue,
      title: doneLabel,
    })
    return () => {
      useModalHeaderState.setState({actionEnabled: false, onAction: undefined, title: ''})
    }
  }, [doneLabel, onContinue])

  const desktopFooter = !Kb.Styles.isMobile ? (
    <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
      <Kb.Button label={continueLabel} onClick={onContinue} fullWidth={true} />
    </Kb.Box2>
  ) : null

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} overflow="hidden">
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
        <Kb.Box2 direction="horizontal" style={styles.header} fullWidth={true} justifyContent="space-between">
          <Kb.Text type="BodySmallSemibold" lineClamp={1} style={styles.flexShrink}>
            Members of {parentTeamName}
          </Kb.Text>
          <Kb.Text type="BodyPrimaryLink" onClick={allSelected ? onSelectNone : onSelectAll}>
            Select {allSelected ? 'none' : 'all'}
          </Kb.Text>
        </Kb.Box2>
        <Kb.BoxGrow>
          <Kb.List
            keyProperty="username"
            items={filteredMembers}
            renderItem={renderItem}
            itemHeight={{sizeType: 'Small', type: 'fixedListItemAuto'}}
          />
        </Kb.BoxGrow>
      </Kb.Box2>
      {desktopFooter}
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  flexShrink: {flexShrink: 1},
  header: {
    alignItems: 'center',
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    height: Kb.Styles.globalMargins.mediumLarge,
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingRight: Kb.Styles.globalMargins.small,
  },
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
  search: {
    borderRadius: 4,
  },
  searchContainer: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
}))

export default AddSubteamMembers
