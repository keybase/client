import React, {Component} from '../base-react'

export default class NoTabRender extends Component {
  render () {
    return (
      <div style={{flex: 1, justifyContent: 'center', backgroundColor: 'red'}}>
        <p> Error! Tab name was not recognized</p>
      </div>
    )
  }
}
