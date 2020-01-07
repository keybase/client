import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'

export type Props = {
  onBack: () => void
  onContinue: (paperkey: string) => void
  paperkeyError?: string
  waiting: boolean
}

type State = {
  paperkey: string
}

class PaperKeyInput extends React.Component<Props, State> {
  state: State = {paperkey: ''}

  render() {
    const errorText = this.props.paperkeyError

    return (
      <Kb.Box2 alignItems="center" direction="vertical" style={styles.container}>
        <Kb.BackButton onClick={this.props.onBack} style={styles.back} />
        <Kb.Icon style={styles.icon} type="icon-paper-key-48" />
        <Kb.LabeledInput
          multiline={true}
          rowsMax={3}
          onChangeText={paperkey => this.setState({paperkey})}
          error={!!errorText}
          placeholder="Enter your paper key"
        />
        {!!errorText && <Kb.Text type="BodySmallError">{errorText}</Kb.Text>}
        <Kb.Button
          label="Continue"
          style={styles.button}
          waiting={this.props.waiting}
          onClick={() => this.props.onContinue(this.state.paperkey)}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  back: {
    left: 30,
    position: 'absolute',
    top: 30,
  },
  button: {marginTop: Styles.globalMargins.small},
  container: {padding: Styles.globalMargins.small},
  icon: {marginBottom: Styles.globalMargins.tiny},
}))

export default PaperKeyInput
