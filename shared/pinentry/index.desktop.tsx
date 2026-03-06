import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import DragHeader from '../desktop/remote/drag-header.desktop'

export type Props = {
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

  const lastShowTyping = React.useRef(_showTyping)
  React.useEffect(() => {
    if (_showTyping !== lastShowTyping.current) {
      lastShowTyping.current = _showTyping
      setShowTyping(_showTyping?.defaultValue ?? false)
    }
  }, [_showTyping])

  const handleCheck = (showTyping: boolean) => {
    setShowTyping(showTyping)
  }

  const handleSubmit = () => {
    onSubmit(password)
    setPassword('')
  }

  const isPaperKey = props.type === T.RPCGen.PassphraseType.paperKey

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <DragHeader icon={false} title="" onClose={props.onCancel} windowDragging={true} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={{paddingLeft: 30, paddingRight: 30}}>
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
          <Kb.Input3
            autoFocus={true}
            error={!!props.retryLabel}
            onChangeText={setPassword}
            onEnterKeyDown={handleSubmit}
            placeholder="Password"
            secureTextEntry={!showTyping}
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
        <Kb.Button2
          style={{alignSelf: 'center'}}
          label={props.submitLabel ?? 'Continue'}
          onClick={handleSubmit}
          disabled={!password}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  alignment: {marginLeft: Kb.Styles.globalMargins.xsmall},
  container: {
    backgroundColor: Kb.Styles.globalColors.white,
    paddingBottom: Kb.Styles.globalMargins.medium,
  },
  inputContainer: {maxWidth: 428},
}))

export default Pinentry
