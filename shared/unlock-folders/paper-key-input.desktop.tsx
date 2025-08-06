import * as React from 'react'
import * as Kb from '@/common-adapters'

export type Props = {
  onBack: () => void
  onContinue: (paperkey: string) => void
  paperkeyError?: string
  waiting: boolean
}

const PaperKeyInput = (props: Props) => {
  const [paperkey, setPaperkey] = React.useState('')
  const errorText = props.paperkeyError

  return (
    <Kb.Box2 alignItems="center" direction="vertical" style={styles.container}>
      <Kb.BackButton onClick={props.onBack} style={styles.back} />
      <Kb.Icon style={styles.icon} type="icon-paper-key-48" />
      <Kb.LabeledInput
        multiline={true}
        rowsMax={3}
        onChangeText={setPaperkey}
        error={!!errorText}
        placeholder="Enter your paper key"
      />
      {!!errorText && <Kb.Text type="BodySmallError">{errorText}</Kb.Text>}
      <Kb.Button
        label="Continue"
        style={styles.button}
        waiting={props.waiting}
        onClick={() => props.onContinue(paperkey)}
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  back: {
    left: 30,
    position: 'absolute',
    top: 30,
  },
  button: {marginTop: Kb.Styles.globalMargins.small},
  container: {padding: Kb.Styles.globalMargins.small},
  icon: {marginBottom: Kb.Styles.globalMargins.tiny},
}))

export default PaperKeyInput
