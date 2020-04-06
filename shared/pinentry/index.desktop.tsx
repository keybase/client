import * as React from 'react'
import * as Kb from '../common-adapters'
import DragHeader from '../desktop/remote/drag-header.desktop'
import * as Styles from '../styles'
import {_setDarkModePreference} from '../styles/dark-mode'
import * as RPCTypes from '../constants/types/rpc-gen'

export type Props = {
  darkMode: boolean
  onSubmit: (password: string) => void
  onCancel: () => void
  showTyping?: RPCTypes.Feature
  type: RPCTypes.PassphraseType
  prompt: string
  retryLabel?: string
  submitLabel?: string
}

type DefaultProps = {
  retryLabel: string
  submitLabel: string
}

const Pinentry = (props: Props) => {
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(props.showTyping?.defaultValue ?? false)

  const onCheck = (showTyping: boolean) => {
    setShowTyping(showTyping)
  }

  const onSubmit = () => {
    props.onSubmit(password)
    setPassword('')
  }

  React.useEffect(() => {
    setShowTyping(props.showTyping?.defaultValue)
  }, [props.showTyping?.defaultValue])

  _setDarkModePreference(props.darkMode ? 'alwaysDark' : 'alwaysLight')
  const isPaperKey = props.type === RPCTypes.PassphraseType.paperKey

  return (
    <Kb.Box
      style={styles.container}
      className={props.darkMode ? 'darkMode' : 'lightMode'}
      key={props.darkMode ? 'darkMode' : 'light'}
    >
      <DragHeader icon={false} title="" onClose={props.onCancel} windowDragging={true} />
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, paddingLeft: 30, paddingRight: 30}}>
        <Kb.Text type="Body" center={true}>
          {props.prompt}
        </Kb.Text>
        {isPaperKey && <Kb.Icon type="icon-paper-key-48" style={{alignSelf: 'center'}} />}
        <Kb.Box2
          alignSelf="center"
          direction="vertical"
          fullWidth={true}
          gap="tiny"
          gapEnd={true}
          gapStart={true}
          style={styles.inputContainer}
        >
          <Kb.LabeledInput
            autoFocus={true}
            error={!!props.retryLabel}
            onChangeText={password => setPassword(password)}
            onEnterKeyDown={onSubmit}
            placeholder={isPaperKey ? 'Type in your entire paper key' : 'Password'}
            type={showTyping ? 'passwordVisible' : 'password'}
            value={password}
          />
          {!!props.retryLabel && (
            <Kb.Text style={styles.alignment} type="BodySmallError">
              {props.retryLabel}
            </Kb.Text>
          )}
          {props.showTyping && props.showTyping.allow && (
            <Kb.Checkbox
              checked={showTyping}
              label={props.showTyping.label}
              onCheck={onCheck}
              style={styles.alignment}
            />
          )}
        </Kb.Box2>
        <Kb.Button
          style={{alignSelf: 'center'}}
          label={props.submitLabel}
          onClick={onSubmit}
          disabled={!password}
        />
      </Kb.Box>
    </Kb.Box>
  )
}

Pinentry.defaultProps = {
  retryLabel: '',
  submitLabel: 'Continue',
}

const styles = Styles.styleSheetCreate(() => ({
  alignment: {marginLeft: Styles.globalMargins.xsmall},
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.white,
    paddingBottom: Styles.globalMargins.medium,
  },
  inputContainer: {maxWidth: 428},
}))

export default Pinentry
