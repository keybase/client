import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import {ModalTitle} from '../../common'
import * as Types from '../../../constants/types/teams'
import * as Constants from '../../../constants/teams'
import {pluralize} from '../../../util/string'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

const AddSubteamMembers = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onClose = () => dispatch(RouteTreeGen.createClearModals())
  const onContinue = () => {} // TODO

  const [selectedMembers, setSelectedMembers] = React.useState(new Set<string>())
  const [filter, setFilter] = React.useState('')
  const filterL = filter.toLowerCase()

  // TODO: populate this
  const parentTeamID = Container.useSelector(
    state => state.teams.newTeamWizard.parentTeamID ?? Types.noTeamID
  )
  const parentTeamName = Container.useSelector(state => Constants.getTeamMeta(state, parentTeamID).teamname)
  const parentMembersMap = Container.useSelector(
    state => Constants.getTeamDetails(state, parentTeamID).members
  )
  const parentMembers = [...parentMembersMap.values()].filter(m => !Constants.isBot(m.type))
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

  const renderItem = (_: number, m: Types.MemberInfo) => (
    <Kb.ListItem2
      type="Small"
      icon={<Kb.Avatar username={m.username} size={32} />}
      body={
        <Kb.Box2 direction="vertical">
          <Kb.ConnectedUsernames type="BodySemibold" usernames={[m.username]} />
          <Kb.Text type="BodySmall">{m.fullName}</Kb.Text>
        </Kb.Box2>
      }
      action={
        <Kb.CheckCircle
          checked={selectedMembers.has(m.username)}
          onCheck={check => {
            // TODO: ensure performance
            check ? selectedMembers.add(m.username) : selectedMembers.delete(m.username)
            setSelectedMembers(new Set([...selectedMembers]))
          }}
        />
      }
      firstItem={true}
      key={m.username}
    />
  )
  return (
    <Kb.Modal
      allowOverflow={true}
      mode="DefaultFullHeight"
      onClose={onClose}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        rightButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onContinue}>
            {doneLabel}
          </Kb.Text>
        ) : (
          undefined
        ),
        title: <ModalTitle teamID={Types.newTeamWizardTeamID} title="Add members" />,
      }}
      footer={
        Styles.isMobile
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

const styles = Styles.styleSheetCreate(() => ({
  flexShrink: {flexShrink: 1},
  header: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.blueGrey,
    height: Styles.globalMargins.mediumLarge,
    justifyContent: 'space-between',
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.small,
  },
  hideOverflow: {overflow: 'hidden'},
  search: {
    borderRadius: 4,
  },
  searchContainer: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall),
}))

export default AddSubteamMembers
