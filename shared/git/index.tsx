import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Row, {NewContext} from './row'
import sortBy from 'lodash/sortBy'
import * as T from '@/constants/types'
import {useLocalBadging} from '@/util/use-local-badging'
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
      channelName: r.teamRepoSettings?.channelName || undefined,
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

const Container = (ownProps: OwnProps) => {
  const loading = C.Waiting.useAnyWaiting(C.waitingKeyGitLoading)
  const loadGit = C.useRPC(T.RPCGen.gitGetAllGitMetadataRpcPromise)
  const clearGitBadges = C.useRPC(T.RPCGen.gregorDismissCategoryRpcPromise)
  const [error, setError] = React.useState<Error | undefined>()
  const [idToInfo, setIDToInfo] = React.useState(new Map<string, T.Git.GitInfo>())
  const expandedRouteApplied = React.useRef(false)
  const isNew = useConfigState(s => s.badgeState?.newGitRepoGlobalUniqueIDs)
  const {badged} = useLocalBadging(new Set(isNew ?? []), () => {
    clearGitBadges(
      [{category: 'new_git_repo'}],
      () => {},
      () => {}
    )
  })
  const {personals, teams} = getRepos(idToInfo)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onShowDelete = (git: T.Git.GitInfo) => {
    navigateAppend({name: 'gitDeleteRepo', params: {name: git.name, teamname: git.teamname}})
  }
  const load = () => {
    loadGit(
      [undefined, C.waitingKeyGitLoading],
      results => {
        const {errors, repos} = parseRepos(results || [])
        const {setGlobalError} = useConfigState.getState().dispatch
        errors.forEach(e => setGlobalError(e))
        setIDToInfo(repos)
        setError(undefined)
      },
      err => {
        setError(err)
      }
    )
  }

  C.Router2.useSafeFocusEffect(() => {
    load()
  })

  const [expandedSet, setExpandedSet] = React.useState(new Set<string>())

  React.useEffect(() => {
    if (expandedRouteApplied.current) {
      return
    }
    const expanded = findExpandedRepoID(idToInfo, ownProps.expandedRepoID, ownProps.expandedTeamname)
    if (!expanded) {
      return
    }
    expandedRouteApplied.current = true
    setExpandedSet(new Set([expanded]))
  }, [idToInfo, ownProps.expandedRepoID, ownProps.expandedTeamname])

  const toggleExpand = (id: string) => {
    expandedSet.has(id) ? expandedSet.delete(id) : expandedSet.add(id)
    setExpandedSet(new Set(expandedSet))
  }

  const makePopup = (p: Kb.Popup2Parms) => {
    const onNewPersonalRepo = () => {
      setError(undefined)
      navigateAppend({name: 'gitNewRepo', params: {isTeam: false}})
    }
    const onNewTeamRepo = () => {
      setError(undefined)
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
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} relative={true}>
        {!!error && <Kb.Banner color="red">{error.message}</Kb.Banner>}
        {Kb.Styles.isMobile && (
          <Kb.ClickableBox ref={popupAnchor} style={styles.header} onClick={showPopup}>
            <Kb.Icon
              type="iconfont-new"
              style={{marginRight: Kb.Styles.globalMargins.tiny}}
              color={Kb.Styles.globalColors.blue}
              fontSize={20}
            />
            <Kb.Text type="BodyBigLink">New encrypted git repository...</Kb.Text>
          </Kb.ClickableBox>
        )}
        <NewContext value={badged}>
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
                setError={setError}
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
        </NewContext>
        {popup}
      </Kb.Box2>
    </Kb.Reloadable>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      header: {
        ...Kb.Styles.globalStyles.flexBoxCenter,
        ...Kb.Styles.globalStyles.flexBoxRow,
        flexShrink: 0,
        height: 48,
      },
    }) as const
)

export default Container
