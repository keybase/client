import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Kb from '../../../common-adapters'
import Qualify from '.'

const rows = [
  {
    subTitle:
      'Some very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long subtitle',
    title: '3 installed devices or paper keys',
    valid: false,
  },
  {subTitle: '', title: 'Old enough Keybase, Github or Hacker News account', valid: true},
  {subTitle: '😁', title: 'A beautiful smile', valid: true},
]

const props = {
  onCancel: Sb.action('onCancel'),
  onLoad: Sb.action('onLoad'),
  onSubmit: Sb.action('onSubmit'),
  rows,
}

class Transitions extends React.Component<any, any> {
  state = {
    machineState: 'loading1',
    rows: [],
    state: 'loading' as 'loading',
  }

  _next = () => {
    this.setState(p => {
      switch (p.machineState) {
        case 'loading1':
          return {
            machineState: 'qualified',
            rows: qualifiedRows,
            state: 'qualified',
          }
        case 'qualified':
          return {
            machineState: 'accepted',
            state: 'accepted',
          }
        case 'accepted':
          return {
            machineState: 'loading2',
            rows: [],
            state: 'loading',
          }
        case 'loading2':
          return {
            machineState: 'unqualified',
            rows: this.props.rows,
            state: 'unqualified',
          }
        case 'unqualified':
          return {
            machineState: 'loading1',
            rows: [],
            state: 'loading',
          }
          default:
              return undefined
      }
    })
  }
  render() {
    return (
      <>
        <Qualify {...props} {...this.props} rows={this.state.rows} state={this.state.state} />
        <Kb.Button
          label={`state: ${this.state.machineState}`}
          onClick={this._next}
          style={{position: 'absolute', right: 0, zIndex: 99999}}
        />
      </>
    )
  }
}

const qualifiedRows = props.rows.map((r, idx) => ({...r, subTitle: idx === 0 ? '' : r.subTitle, valid: true}))

const load = () => {
  Sb.storiesOf('Settings/AirdropQualify', module)
    .add('Sad', () => <Qualify {...props} state="unqualified" />)
    .add('Happy', () => <Qualify {...props} rows={qualifiedRows} state="qualified" />)
    .add('Loading', () => <Qualify {...props} rows={[]} state="loading" />)
    .add('Accepted', () => <Qualify {...props} state="accepted" />)
    .add('Transitions', () => <Transitions {...props} />)
}

export default load
