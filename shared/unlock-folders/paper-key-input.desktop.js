// @flow

import React, {Component} from 'react'
import {globalStyles} from '../styles'
import {Text, Button, BackButton, Icon, Input} from '../common-adapters'
import HiddenString from '../util/hidden-string'

export type Props = {
  onBack: () => void,
  onContinue: (paperkey: HiddenString) => void,
  paperkeyError: ?string,
  waiting: ?boolean,
}

type State = {
  paperkey: string,
}

class PaperKeyInput extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {paperkey: ''}
  }

  render() {
    const errorText = this.props.paperkeyError

    return (
      <div style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <BackButton onClick={this.props.onBack} style={backStyle} />
        <Text style={headerTextStyle} type="Body">
          Type in your paper key:
        </Text>
        <Icon style={paperKeyIconStyle} type="icon-paper-key-48" />
        <Input
          multiline={true}
          rowsMax={3}
          style={paperKeyInputStyle}
          onChangeText={paperkey => this.setState({paperkey})}
          errorText={errorText}
          floatingHintTextOverride="Paper key"
          hintText="elephont sturm cectus opp blezzard tofi pando agg whi pany yaga jocket daubt ruril globil cose"
        />
        <Button
          type="Primary"
          label="Continue"
          style={continueStyle}
          waiting={this.props.waiting}
          onClick={() =>
            this.props.onContinue(new HiddenString(this.state.paperkey))}
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
  marginTop: 4,
  width: 440,
  height: '4em',
}

const backStyle = {
  position: 'absolute',
  top: 30,
  left: 30,
}

const continueStyle = {
  marginTop: 38,
  height: 32,
  width: 116,
  alignSelf: 'center',
}

export default PaperKeyInput
