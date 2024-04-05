import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import {pickSave} from '@/util/pick-files'

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
  | {
      type: 'fsPath'
      path: string
    }

const ArchiveModal = (p: Props) => {
  const {type} = p
  const displayname = React.useMemo(() => {
    return p.type === 'chatID' ? C.useArchiveState.getState().chatIDToDisplayname(p.conversationIDKey) : ''
  }, [p])

  let defaultPath = `${C.downloadFolder}/kb-archive-`
  if (C.isElectron) {
    switch (type) {
      case 'chatID':
        defaultPath += `${displayname.replaceAll(',', '_').replaceAll('#', '_')}`
        break
      case 'chatAll':
        defaultPath += `chat`
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
    }
  }

  const [outpath, setOutpath] = React.useState(defaultPath)
  const [started, setStarted] = React.useState(false)
  const start = C.useArchiveState(s => s.dispatch.start)
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
        start('kbfs', '.', outpath)
        break
      case 'chatTeam':
        start('chatname', p.teamname, outpath)
        break
      case 'fsPath':
        start('kbfs', p.path, outpath)
        break
    }
  }, [outpath, canStart, p, start])
  const onClose = React.useCallback(() => {
    navigateUp()
  }, [navigateUp])
  const onProgress = React.useCallback(() => {
    navigateUp()
    setTimeout(() => {
      switchTab(C.Tabs.settingsTab)
      setTimeout(() => {
        // so we can go into the sub nav, very unusual so kinda hacky
        C.Router2._getNavigator()?.navigate(C.Settings.settingsArchiveTab)
      }, 200)
    }, 200)
  }, [navigateUp, switchTab])

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
      content = <Kb.Text type="Body">Source: All KBFS</Kb.Text>
      break
    case 'fsPath':
      content = <Kb.Text type="Body">Source: KBFS folder: {p.path}</Kb.Text>
      break
  }

  const output = Kb.Styles.isMobile ? null : (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="center">
      <Kb.Text type="Body">To:</Kb.Text>
      <Kb.BoxGrow style={{height: 22}}>
        <Kb.Text type="BodyItalic" lineClamp={1} title={outpath} style={styles.outPath}>
          {outpath}
        </Kb.Text>
      </Kb.BoxGrow>
      <Kb.Button small={true} label="Change" onClick={selectPath} style={styles.selectOutput} />
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
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="medium" style={styles.container}>
        {Kb.Styles.isMobile ? (
          <Kb.Text type="Body">Share a copy of your content to another app</Kb.Text>
        ) : (
          <Kb.Text type="Body">Save a copy of your content to your local drive</Kb.Text>
        )}
        {content}
        {output}
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {padding: Kb.Styles.isMobile ? 8 : 16},
  outPath: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.blue_30,
      borderColor: Kb.Styles.globalColors.grey,
      borderRadius: Kb.Styles.borderRadius,
      padding: 2,
      wordBreak: 'break-all',
    },
  }),
  selectOutput: {
    alignSelf: 'flex-start',
  },
}))

export default ArchiveModal
