import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'

export type Props = {
  onBack: () => void
  onContinue: (paperkey: string) => void
  paperkeyError: string | null
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
      <div style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Kb.BackButton onClick={this.props.onBack} style={backStyle} />
        <Kb.Text style={headerTextStyle} type="Body">
          Type in your paper key:
        </Kb.Text>
        <Kb.Icon style={paperKeyIconStyle} type="icon-paper-key-48" />
        <Kb.Input
          multiline={true}
          rowsMax={3}
          style={paperKeyInputStyle}
          onChangeText={paperkey => this.setState({paperkey})}
          errorText={errorText}
          floatingHintTextOverride="Paper key"
          hintText="elephont sturm cectus opp blezzard tofi pando agg whi pany yaga jocket daubt
ruril globil cose"
          uncontrolled={true}
        />
        <Kb.Button
          label="Continue"
          style={continueStyle}
          waiting={this.props.waiting}
          onClick={() => this.props.onContinue(this.state.paperkey)}
        />
      </div>
    )
  }
}

const headerTextStyle = {
  marginTop: 30,
}

const paperKeyIconStyle = {
  marginTop: 6,
}

const paperKeyInputStyle = {
  height: '4em',
  marginTop: 4,
  width: 440,
}

const backStyle = {
  left: 30,
  position: 'absolute' as const,
  top: 30,
}

const continueStyle = {
  alignSelf: 'center',
  height: 32,
  marginTop: 38,
  width: 116,
} as const

export default PaperKeyInput
