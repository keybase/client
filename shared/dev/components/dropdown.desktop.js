// @flow
import React, {Component} from 'react'
import Dropdown from '../../common-adapters/dropdown'

export default class DropdownDemo extends Component {
  state: any;

  constructor (props: {}) {
    super(props)
    this.state = {selectedUser: 'marcopolo', selectedOption: null}
  }

  render () {
    return (
      <div style={{display: 'flex', justifyContent: 'space-around'}}>
        <Dropdown type={'Username'}
          value={this.state.selectedUser}
          options={['marcopolo', 'chris', 'cjb', 'bbbbbbbbbbbbbbbb']}
          onOther={() => console.log('Clicked on other')}
          onClick={selectedUser => this.setState({selectedUser})} />
        <Dropdown type={'General'}
          options={['one', 'two', 'three']}
          value={this.state.selectedOption}
          onOther={() => console.log('Clicked on other')}
          onClick={selectedOption => this.setState({selectedOption})} />
        <Dropdown type={'General'}
          options={['one', 'two', 'three']}
          value={this.state.selectedOption}
          onClick={selectedOption => this.setState({selectedOption})} />
      </div>
    )
  }
}
