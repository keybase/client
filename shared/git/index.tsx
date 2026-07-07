import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import Row from './row'
import sortBy from 'lodash/sortBy'
import * as T from '@/constants/types'
import {NewItemsContext, useLocalBadging} from '@/util/use-local-badging'
import {useRPCLoad} from '@/util/use-rpc-load'
import {useConfigState} from '@/stores/config'
import * as dateFns from 'date-fns'

type OwnProps = {
  expandedRepoID?: string
  expandedTeamname?: string
}

const parseRepoResult = (result: T.RPCGen.GitRepoResult): T.Git.GitInfo | undefined => {
  if (result.state === T.RPCGen.GitRepoResultState.ok) {
    const r: T.RPCGen.GitRepoInfo = result.ok
    if (r.folder.folderType === T.RPCGen.FolderType.public) {
      return undefined
    }
    const teamname = r.folder.folderType === T.RPCGen.FolderType.team ? r.folder.name : undefined
    return {
      canDelete: r.canDelete,
      chatDisabled: !!r.teamRepoSettings?.chatDisabled,
      devicename: r.serverMetadata.lastModifyingDeviceName,
      id: r.globalUniqueID,
      lastEditTime: dateFns.formatDistanceToNow(new Date(r.serverMetadata.mtime), {addSuffix: true}),
      lastEditUser: r.serverMetadata.lastModifyingUsername,
      name: r.localMetadata.repoName,
      repoID: r.repoID,
      teamname,
      url: r.repoUrl,
    }
  }
  return undefined
}

const parseRepoError = (result: T.RPCGen.GitRepoResult): Error => {
  let errStr = 'unknown'
  if (result.state === T.RPCGen.GitRepoResultState.err && result.err) {
    errStr = result.err
  }
  return new Error(`Git repo error: ${errStr}`)
}

const parseRepos = (results: ReadonlyArray<T.RPCGen.GitRepoResult>) => {
  const errors: Array<Error> = []
  const repos = new Map<string, T.Git.GitInfo>()
  results.forEach(result => {
    if (result.state === T.RPCGen.GitRepoResultState.ok) {
      const parsedRepo = parseRepoResult(result)
      if (parsedRepo) {
        repos.set(parsedRepo.id, parsedRepo)
      }
    } else {
      errors.push(parseRepoError(result))
    }
  })
  return {errors, repos}
}

const findExpandedRepoID = (
  repos: ReadonlyMap<string, T.Git.GitInfo>,
  repoID?: string,
  teamname?: string
) => {
  if (!repoID || !teamname) {
    return undefined
  }
  for (const [id, info] of repos) {
    if (info.repoID === repoID && info.teamname === teamname) {
      return id
    }
  }
  return undefined
}

const getRepos = (git: T.Immutable<Map<string, T.Git.GitInfo>>) =>
  sortBy([...git.values()], ['teamname', 'name']).reduce<{personals: Array<string>; teams: Array<string>}>(
    (pt, info) => {
      const target = info.teamname ? pt.teams : pt.personals
      target.push(info.id)
      return pt
    },
    {personals: [], teams: []}
  )

type ExpandedState = {
  appliedRouteKey: string
  expandedSet: Set<string>
}

const noRepos = new Map<string, T.Git.GitInfo>()

const GitRoot = (ownProps: OwnProps) => {
  const loading = C.Waiting.useAnyWaiting(C.waitingKeyGitLoading)
  const clearGitBadges = C.useRPC(T.RPCGen.gregorDismissCategoryRpcPromise)
  // errors from row actions (toggling chat), load errors come from the hook
  const [rowError, setRowError] = React.useState<Error | undefined>()
  const isNew = useConfigState(s => s.badgeState?.newGitRepoGlobalUniqueIDs)
  const {badged} = useLocalBadging(new Set(isNew ?? []), () => {
    clearGitBadges(
      [{category: 'new_git_repo'}],
      () => {},
      () => {}
    )
  })
  const {
    data,
    error: loadError,
    // bumped on every (re)load so expanded rows refetch their lazily-loaded
    // channel name (e.g. after returning from the channel selector)
    loadCount: refreshToken,
    reload: load,
  } = useRPCLoad(T.RPCGen.gitGetAllGitMetadataRpcPromise, [undefined, C.waitingKeyGitLoading], {
    map: results => parseRepos(results || []),
    onResult: ({errors}) => {
      setRowError(undefined)
      const {setGlobalError} = useConfigState.getState().dispatch
      errors.forEach(e => setGlobalError(e))
    },
    when: 'focus',
  })
  const idToInfo = data?.repos ?? noRepos
  const {personals, teams} = getRepos(idToInfo)
  const navigateAppend = C.Router2.navigateAppend
  const onShowDelete = (git: T.Git.GitInfo) => {
    navigateAppend({name: 'gitDeleteRepo', params: {name: git.name, teamname: git.teamname}})
  }

  const [expandedState, setExpandedState] = React.useState<ExpandedState>(() => ({
    appliedRouteKey: '',
    expandedSet: new Set(),
  }))
  const expandedRouteKey =
    ownProps.expandedRepoID && ownProps.expandedTeamname
      ? `${ownProps.expandedTeamname}:${ownProps.expandedRepoID}`
      : ''
  let expandedSet = expandedState.expandedSet
  if (expandedRouteKey && expandedState.appliedRouteKey !== expandedRouteKey) {
    const expanded = findExpandedRepoID(idToInfo, ownProps.expandedRepoID, ownProps.expandedTeamname)
    if (expanded) {
      expandedSet = new Set([expanded])
      setExpandedState({appliedRouteKey: expandedRouteKey, expandedSet})
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedState(state => {
      const nextExpandedSet = new Set(state.expandedSet)
      if (nextExpandedSet.has(id)) {
        nextExpandedSet.delete(id)
      } else {
        nextExpandedSet.add(id)
      }
      return {...state, expandedSet: nextExpandedSet}
    })
  }

  const makePopup = (p: Kb.Popup2Parms) => {
    const onNewPersonalRepo = () => {
      setRowError(undefined)
      navigateAppend({name: 'gitNewRepo', params: {isTeam: false}})
    }
    const onNewTeamRepo = () => {
      setRowError(undefined)
      navigateAppend({name: 'gitNewRepo', params: {isTeam: true}})
    }
    const {attachTo, hidePopup} = p
    const menuItems = [
      {icon: 'iconfont-person', onClick: onNewPersonalRepo, title: 'New personal repository'} as const,
      {icon: 'iconfont-people', onClick: onNewTeamRepo, title: 'New team repository'} as const,
    ]

    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        closeOnSelect={true}
        items={menuItems}
        onHidden={hidePopup}
        visible={true}
        position="bottom center"
      />
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Reloadable waitingKeys={C.waitingKeyGitLoading} onBack={undefined} onReload={load}>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} relative={true} testID={TestIDs.GIT_REPO_LIST}>
        <Kb.ErrorBanner error={rowError ?? loadError} />
        {isMobile && (
          <Kb.ClickableBox ref={popupAnchor} direction="horizontal" centerChildren={true} noShrink={true} gap="tiny" style={styles.header} onClick={showPopup}>
            <Kb.Icon type="iconfont-new" color={Kb.Styles.globalColors.blue} fontSize={20} />
            <Kb.Text type="BodyBigLink">New encrypted git repository...</Kb.Text>
          </Kb.ClickableBox>
        )}
        <NewItemsContext value={badged}>
          <Kb.SectionList
            keyExtractor={item => item}
            extraData={expandedSet}
            renderItem={({item}) => (
              <Row
                key={item}
                expanded={expandedSet.has(item)}
                git={idToInfo.get(item)!}
                onShowDelete={onShowDelete}
                reload={load}
                refreshToken={refreshToken}
                setError={setRowError}
                onToggleExpand={toggleExpand}
              />
            )}
            renderSectionHeader={({section}) => (
              <Kb.SectionDivider label={section.title} showSpinner={section.loading} />
            )}
            sections={[
              {data: personals, loading: loading, title: 'Personal'},
              {data: teams, loading: loading, title: 'Team'},
            ]}
          />
        </NewItemsContext>
        {popup}
      </Kb.Box2>
    </Kb.Reloadable>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      header: {
        height: 48,
      },
    }) as const
)

export default GitRoot
