import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import DragHeader from '../desktop/remote/drag-header.desktop'

export type Props = {
  darkMode: boolean
  onSubmit: (password: string) => void
  onCancel: () => void
  showTyping?: T.RPCGen.Feature
  type: T.RPCGen.PassphraseType
  prompt: string
  retryLabel?: string
  submitLabel?: string
}

const Pinentry = (props: Props) => {
  const {showTyping: _showTyping, onSubmit} = props
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(_showTyping?.defaultValue ?? false)

  React.useEffect(() => {
    C.useDarkModeState.getState().dispatch.setSystemDarkMode(props.darkMode)
  }, [props.darkMode])

  const lastShowTyping = React.useRef(_showTyping)
  React.useEffect(() => {
    if (_showTyping !== lastShowTyping.current) {
      lastShowTyping.current = _showTyping
      setShowTyping(_showTyping?.defaultValue ?? false)
    }
  }, [_showTyping])

  const handleCheck = React.useCallback((showTyping: boolean) => {
    setShowTyping(showTyping)
  }, [])

  const handleSubmit = React.useCallback(() => {
    onSubmit(password)
    setPassword('')
  }, [password, onSubmit])

  const isPaperKey = props.type === T.RPCGen.PassphraseType.paperKey

  return (
    <Kb.Box style={styles.container}>
      <DragHeader icon={false} title="" onClose={props.onCancel} windowDragging={true} />
      <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, paddingLeft: 30, paddingRight: 30}}>
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
            onChangeText={setPassword}
            onEnterKeyDown={handleSubmit}
            placeholder="Password"
            type={showTyping ? 'passwordVisible' : 'password'}
            value={password}
          />
          {props.retryLabel ? (
            <Kb.Text style={styles.alignment} type="BodySmallError">
              {props.retryLabel}
            </Kb.Text>
          ) : null}
          {props.showTyping && props.showTyping.allow && (
            <Kb.Checkbox
              checked={showTyping}
              label={props.showTyping.label}
              onCheck={handleCheck}
              style={styles.alignment}
            />
          )}
        </Kb.Box2>
        <Kb.Button
          style={{alignSelf: 'center'}}
          label={props.submitLabel ?? 'Continue'}
          onClick={handleSubmit}
          disabled={!password}
        />
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  alignment: {marginLeft: Kb.Styles.globalMargins.xsmall},
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    backgroundColor: Kb.Styles.globalColors.white,
    paddingBottom: Kb.Styles.globalMargins.medium,
  },
  inputContainer: {maxWidth: 428},
}))

export default Pinentry
