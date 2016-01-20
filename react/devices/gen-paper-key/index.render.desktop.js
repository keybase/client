import React, {Component} from '../../base-react'

export default class GenPaperKeyRender extends Component {
  render () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1}}>
        <h1>Generate a new paper key</h1>
        <h2 style={{marginTop: 20}}>Here is your paper key for Keybase. Please write this down on a piece of paper and keep it somewhere safe, as this will be used to lorem ipsum leorem</h2>
        <div style={{display: 'flex', backgroundColor: 'grey', padding: 20, margin: 20, marginTop: 40, flexDirection: 'row', alignItems: 'center'}}>
          <p style={{marginRight: 20, height: 60, textAlign: 'center'}}>[Icon]</p>
          {this.props.paperKey && <p style={{flex: 1}}>{this.props.paperKey}</p>}
          {!this.props.paperKey && <p>Loading...</p>}
        </div>
      </div>
    )
  }
}

GenPaperKeyRender.propTypes = {
  paperKey: React.PropTypes.string
}
