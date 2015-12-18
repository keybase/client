import React, {Component} from '../base-react'
import commonStyles from '../styles/common'

export default class Render extends Component {
  render () {
    return (
      <div style={{...commonStyles.flexBoxRow, flexWrap: 'wrap'}}>
        {Object.keys(this.props.colors).sort().map(c => {
          return (
            <p key={c} style={{backgroundColor: this.props.colors[c], margin: 5, padding: 20, minWidth: 100, textAlign: 'center', textShadow: '1px 1px 1px #FFF'}}>{c}</p>
          ) }
        )}
      </div>)
  }
}

Render.propTypes = {
  colors: React.PropTypes.any
}
