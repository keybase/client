// @flow
import * as React from 'react'
import ReactDice from 'react-dice-complete'
import 'react-dice-complete/dist/react-dice-complete.css'

type Props = {
  onRollDone: number => void,
  values?: Array<number>,
}

export default class Dice extends React.Component<Props> {
  reactDice: any
  componentDidMount() {
    this.reactDice.rollAll()
  }
  render() {
    return (
      <ReactDice
        disableIndividual={true}
        dotColor="white"
        faceColor="linear-gradient(-45deg, #f0a24c, #f6cc60)"
        numDice={2}
        ref={r => (this.reactDice = r)}
        rollDone={this.props.onRollDone}
        values={this.props.values}
      />
    )
  }
}
