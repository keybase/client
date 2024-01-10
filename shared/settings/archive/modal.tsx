import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type * as T from '@/constants/types'

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
  const [outpath, setOutpath] = React.useState('')
  const [started, setStarted] = React.useState(false)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onStart = React.useCallback(() => {
    outpath && setStarted(true)
  }, [outpath])
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
    // TODO
    setOutpath('TEMP')
  }, [])

  let content: React.ReactNode = null
  switch (type) {
    case 'chatID':
      content = <Kb.Text type="Body">{p.conversationIDKey}</Kb.Text>
      break
    case 'chatTeam':
      content = <Kb.Text type="Body">{p.teamname}</Kb.Text>
      break
    case 'chatAll':
      content = <Kb.Text type="Body">All chats</Kb.Text>
      break
    case 'fsAll':
      content = <Kb.Text type="Body">All KBFS</Kb.Text>
      break
    case 'fsPath':
      content = <Kb.Text type="Body">{p.path}</Kb.Text>
      break
  }

  const output = Kb.Styles.isMobile ? null : (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="medium">
      {outpath ? (
        <Kb.Text type="BodyItalic" lineClamp={1}>
          {outpath}
        </Kb.Text>
      ) : (
        <Kb.Button label="Select output path" onClick={selectPath} style={styles.selectOutput} />
      )}
    </Kb.Box2>
  )

  const modalHeader = Kb.useModalHeaderTitleAndCancel('Archive', onClose)
  // TODO footer not showing on mobile?
  // check mobile routring of progress

  return (
    <Kb.Modal2
      header={modalHeader}
      footer={{
        content: Kb.Styles.isMobile ? (
          <Kb.Text type="BodyBig">DEBUG</Kb.Text>
        ) : (
          <Kb.ButtonBar small={true}>
            {started && <Kb.Button type="Default" label="See progress" onClick={onProgress} />}
            {started && <Kb.Button type="Default" label="Close" onClick={onClose} />}
            {!started && (
              <Kb.Button type="Default" label="Start" onClick={onStart} disabled={outpath.length <= 0} />
            )}
          </Kb.ButtonBar>
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="medium" style={styles.container}>
        <Kb.Text type="Body">{type}</Kb.Text>
        {content}
        {output}
      </Kb.Box2>
    </Kb.Modal2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {padding: Kb.Styles.isMobile ? 8 : 16},
  selectOutput: {alignSelf: 'flex-start'},
}))

export default ArchiveModal
