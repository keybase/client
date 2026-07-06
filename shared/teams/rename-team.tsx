import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {renameTeam} from './actions'
import {useNavUpWhenDone} from './common/use-nav-up-when-done'

type OwnProps = {teamname: string}

const RenameTeam = (ownProps: OwnProps) => {
  const teamname = ownProps.teamname
  const waitingError = C.Waiting.useAnyErrors(C.waitingKeyTeamsRename)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsRename)
  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    dispatchClearWaiting(C.waitingKeyTeamsRename)
    navigateUp()
  }
  const propError = waitingError?.message || ''
  const onRename = (newName: string) => renameTeam(teamname, newName)

  const [error, setError] = React.useState('')
  const [newName, setNewName] = React.useState('')

  const teamNameParts = splitTeamname(teamname)
  const originalName = teamNameParts.pop() || ''
  const prefix = teamNameParts.join('.')

  useNavUpWhenDone(waiting, propError)

  const newFullName = [prefix, newName].join('.')
  const disabled = newName.length < 2

  const validateTeamname = () => {
    if (newName.startsWith('_') || newName.includes('__')) {
      setError("Teamnames can't start with underscores or use double underscores to avoid confusion.")
      return false
    }
    if (invalidChars.test(newName)) {
      setError('Teamnames can only use letters (a-z), numbers, and underscores.')
      return false
    }
    return true
  }

  const handleRename = () => {
    if (waiting || disabled) {
      return
    }
    if (teamname === newFullName) {
      onCancel()
      return
    }
    setError('')
    if (validateTeamname()) {
      onRename(newFullName)
    }
  }

  return (
    <Kb.Box2 alignItems="center" direction="vertical" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} gap="medium" gapStart={true}>
        <Kb.Avatar teamname={teamname} size={isMobile ? 64 : 48} />
        <Kb.Box2 alignItems="center" direction="vertical" gap="tiny" style={styles.teamnameHeader}>
          <Kb.Text type="BodySmall" center={true}>
            Subteam of {prefix}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        gap="tiny"
        alignItems="flex-start"
        fullWidth={true}
        style={styles.body}
      >
        <Kb.Box2
          direction="horizontal"
          style={Kb.Styles.collapseStyles([
            styles.inputContainer,
            propError && styles.inputContainerError,
          ] as const)}
          fullWidth={true}
        >
          <Kb.Input3
            autoFocus={true}
            disabled={waiting}
            onChangeText={setNewName}
            onEnterKeyDown={handleRename}
            maxLength={16}
            placeholder={originalName}
            hideBorder={true}
          />
        </Kb.Box2>
        {(!!error || !!propError) && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {error || propError}
          </Kb.Text>
        )}
        {newName ? (
          <Kb.Text type="BodySmall">
            This team will be named{' '}
            <Kb.Text type="BodySmallSemibold">
              {prefix}.{newName.toLowerCase()}
            </Kb.Text>
          </Kb.Text>
        ) : (
          <Kb.Text type="BodySmall">Write a name to see a preview.</Kb.Text>
        )}
      </Kb.Box2>
      <Kb.ButtonBar direction="row" style={styles.buttonBar}>
        {!isMobile && (
          <Kb.Button type="Dim" label="Cancel" onClick={onCancel} style={styles.button} />
        )}
        <Kb.Button
          label="Rename"
          onClick={handleRename}
          style={styles.button}
          disabled={disabled}
          waiting={waiting}
        />
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const splitTeamname = (teamname: string) => teamname.split('.')

const invalidChars = /[^a-zA-Z0-9_]/

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      body: Kb.Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.large),
        },
        isMobile: {
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
        },
      }),
      button: {flex: 1},
      buttonBar: {
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
      container: Kb.Styles.platformStyles({
        common: {flex: 1},
      }),
      error: {color: Kb.Styles.globalColors.redDark},
      inputContainer: {
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        padding: Kb.Styles.globalMargins.tiny,
      },
      inputContainerError: {borderColor: Kb.Styles.globalColors.red},
      teamnameHeader: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-word'} as const,
      }),
    }) as const
)

export default RenameTeam
