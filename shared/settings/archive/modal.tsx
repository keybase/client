import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import {pickSave} from '@/util/pick-files'
import * as FsCommon from '@/fs/common'

type Props =
  | {
      type: 'chatID'
      conversationIDKey: T.Chat.ConversationIDKey
    }
  | {
      type: 'chatTeam'
      teamname: string
    }
  | {type: 'chatAll'}
  | {type: 'fsAll'}
  | {type: 'gitAll'}
  | {
      type: 'fsPath'
      path: string
    }
  | {
      type: 'git'
      gitURL: string
    }

const ArchiveModal = (p: Props) => {
  const {type} = p
  const displayname = React.useMemo(() => {
    return p.type === 'chatID' ? C.useArchiveState.getState().chatIDToDisplayname(p.conversationIDKey) : ''
  }, [p])

  let defaultPath = ''
  if (C.isElectron) {
    defaultPath = `${C.downloadFolder}/kb-archive-`
    switch (type) {
      case 'chatID':
        defaultPath += `${displayname.replaceAll(',', '_').replaceAll('#', '_')}`
        break
      case 'chatAll':
        defaultPath += `chat`
        break
      case 'gitAll':
        defaultPath = `${C.downloadFolder}/keybase-git`
        break
      case 'chatTeam':
        defaultPath += p.teamname
        break
      case 'fsAll':
        defaultPath += `fs`
        break
      case 'fsPath':
        defaultPath += `${p.path.replaceAll('/', '_')}`
        break
      case 'git':
        defaultPath = `${C.downloadFolder}/keybase-${p.gitURL.replaceAll('/', '_')}`
        break
    }
  }

  const [outpath, setOutpath] = React.useState(defaultPath)
  const [started, setStarted] = React.useState(false)
  const start = C.useArchiveState(s => s.dispatch.start)
  const resetWaiters = C.useArchiveState(s => s.dispatch.resetWaiters)
  const archiveAllFilesResponseWaiter = C.useArchiveState(s => s.archiveAllFilesResponseWaiter)
  const archiveAllGitResponseWaiter = C.useArchiveState(s => s.archiveAllGitResponseWaiter)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)

  const canStart = !!((C.isMobile || outpath) && !started)

  const onStart = React.useCallback(() => {
    if (!canStart) return
    setStarted(true)
    switch (p.type) {
      case 'chatID':
        start('chatid', p.conversationIDKey, outpath)
        break
      case 'chatAll':
        start('chatname', '.', outpath)
        break
      case 'fsAll':
        start('kbfs', '/keybase', C.isMobile ? '' : outpath)
        break
      case 'gitAll':
        start('git', '.', C.isMobile ? '' : outpath)
        break
      case 'chatTeam':
        start('chatname', p.teamname, outpath)
        break
      case 'fsPath':
        start('kbfs', p.path, C.isMobile ? '' : outpath)
        break
      case 'git':
        start('git', p.gitURL, C.isMobile ? '' : outpath)
        break
    }
  }, [outpath, canStart, p, start])
  const onClose = React.useCallback(() => {
    resetWaiters()
    navigateUp()
  }, [navigateUp, resetWaiters])
  const onProgress = React.useCallback(() => {
    resetWaiters()
    navigateUp()
    setTimeout(() => {
      switchTab(C.Tabs.settingsTab)
      setTimeout(() => {
        // so we can go into the sub nav, very unusual so kinda hacky
        C.Router2._getNavigator()?.navigate(C.Settings.settingsArchiveTab)
      }, 200)
    }, 200)
  }, [navigateUp, resetWaiters, switchTab])

  const selectPath = React.useCallback(() => {
    const f = async () => {
      const path = await pickSave({})
      if (path) setOutpath(path)
    }
    C.ignorePromise(f())
  }, [])

  let content: React.ReactNode = null
  switch (type) {
    case 'chatID':
      content = <Kb.Text type="Body">Source: Chat conversation: {displayname}</Kb.Text>
      break
    case 'chatTeam':
      content = <Kb.Text type="Body">Source: Chat team: {p.teamname}</Kb.Text>
      break
    case 'chatAll':
      content = <Kb.Text type="Body">Source: All chats</Kb.Text>
      break
    case 'fsAll':
      content =
        archiveAllFilesResponseWaiter.state === 'idle' ? (
          <Kb.Box2 direction="vertical" centerChildren={true} style={styles.contentContainer} gap="small">
            <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.contentContainer} gap="small">
              <Kb.Icon type="iconfont-nav-2-files" fontSize={72} />
              <Kb.Text type="Header">All Files</Kb.Text>
            </Kb.Box2>
            <Kb.Text type="Body">
              Note: public folders that you are not a writer of will be skipped. Use{' '}
              <Kb.Text type="TerminalInline">keybase fs archive</Kb.Text> if you want to archive them.
            </Kb.Text>
          </Kb.Box2>
        ) : archiveAllFilesResponseWaiter.state === 'waiting' ? (
          <Kb.LoadingLine />
        ) : (
          <Kb.Box2 direction="vertical" centerChildren={true} style={styles.contentContainer} gap="small">
            <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.contentContainer} gap="small">
              <Kb.Icon type="iconfont-nav-2-files" fontSize={72} />
              <Kb.Text type="Header">All Files</Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="vertical" centerChildren={true}>
              <Kb.Text type="Body">
                Started {archiveAllFilesResponseWaiter.started} jobs successfully.
              </Kb.Text>
              <Kb.Text type="Body">Skipped {archiveAllFilesResponseWaiter.skipped} folders.</Kb.Text>
              <Kb.Text type="Body">Encountered {archiveAllFilesResponseWaiter.errors.size} errors.</Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        )
      break
    case 'gitAll':
      content =
        archiveAllGitResponseWaiter.state === 'idle' ? (
          <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.contentContainer} gap="small">
            <Kb.Icon type="iconfont-nav-2-git" fontSize={72} />
            <Kb.Text type="Header">All Git Repos</Kb.Text>
          </Kb.Box2>
        ) : archiveAllGitResponseWaiter.state === 'waiting' ? (
          <Kb.LoadingLine />
        ) : (
          <Kb.Box2 direction="vertical" centerChildren={true} style={styles.contentContainer} gap="small">
            <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.contentContainer} gap="small">
              <Kb.Icon type="iconfont-nav-2-git" fontSize={72} />
              <Kb.Text type="Header">All Git Repos</Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="vertical" centerChildren={true}>
              <Kb.Text type="Body">Started {archiveAllGitResponseWaiter.started} jobs successfully.</Kb.Text>
              <Kb.Text type="Body">Encountered {archiveAllGitResponseWaiter.errors.size} errors.</Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        )
      break
    case 'fsPath':
      content = (
        <Kb.WithTooltip tooltip={p.path} position="bottom center" toastStyle={styles.contentContainer}>
          <FsCommon.PathItemInfo path={p.path} />
        </Kb.WithTooltip>
      )
      break
    case 'git':
      content = (
        <Kb.Box2 direction="vertical" centerChildren={true} style={styles.contentContainer} gap="small">
          <Kb.Icon type="iconfont-nav-2-git" fontSize={72} />
          <Kb.Text type="TerminalInline" lineClamp={2}>
            {p.gitURL}
          </Kb.Text>
        </Kb.Box2>
      )
      break
  }

  const output = Kb.Styles.isMobile ? null : (
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center">
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
        <Kb.Text type="Body">Save To</Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Text type="BodyItalic" lineClamp={1} title={outpath} style={styles.outPath}>
          {outpath}
        </Kb.Text>
        <Kb.BoxGrow />
        <Kb.Text type="BodyPrimaryLink" onClick={selectPath}>
          Change
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )

  const modalHeader = Kb.useModalHeaderTitleAndCancel('Archive', onClose)
  return (
    <Kb.Modal
      mode="Wide"
      header={modalHeader}
      footer={{
        content: (
          <Kb.ButtonBar small={true}>
            {started && <Kb.Button type="Default" label="See progress" onClick={onProgress} />}
            {started && <Kb.Button type="Default" label="Close" onClick={onClose} />}
            {!started && <Kb.Button type="Default" label="Start" onClick={onStart} disabled={!canStart} />}
          </Kb.ButtonBar>
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="small" style={styles.container}>
        {Kb.Styles.isMobile ? (
          <Kb.Text type="Body">Share a copy of your content to another app</Kb.Text>
        ) : (
          <Kb.Text type="Body">Save a copy of your content to your local drive</Kb.Text>
        )}
        <Kb.BoxGrow />
        {content}
        <Kb.BoxGrow />
        {archiveAllFilesResponseWaiter.state !== 'idle' || archiveAllGitResponseWaiter.state !== 'idle'
          ? null
          : output}
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {padding: Kb.Styles.isMobile ? 8 : 16},
  contentContainer: {
    maxWidth: 400,
  },
  outPath: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.blue_30,
      borderColor: Kb.Styles.globalColors.grey,
      borderRadius: Kb.Styles.borderRadius,
      padding: 2,
      wordBreak: 'break-all',
    },
  }),
}))

export default ArchiveModal
