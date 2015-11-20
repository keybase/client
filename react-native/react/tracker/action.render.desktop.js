import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'

import commonStyles from '../styles/common'

// TODO constants when integrating
const normal = 'normal'
const warning = 'warning'
const error = 'error'

export default class ActionRender extends Component {
  render () {
    if (this.props.state === normal) {
      return this.renderNormal()
    } else {
      return this.renderChanged()
    }
  }

  renderChanged () {
    const title = this.props.state === warning ? `${this.props.username} added some idenitity proofs.`
      : `Some of ${this.props.username}'s proofs are compromised or have changed.`
    return (
      <div style={{...styles.normalContainer, ...this.props.style}}>
        <i style={this.props.state === warning ? styles.flagWarning : styles.flagError} className='fa fa-flag'></i>
        <div style={styles.textContainer}>
          <span style={styles.changedMessage}>{title}</span>
        </div>
        <FlatButton style={styles.secondary} label='Untrack' primary onTouchTap={() => this.props.onUnfollow()} />
        <FlatButton style={styles.primary} label='Retrack' primary onTouchTap={() => this.props.onRefollow()} />
      </div>
    )
  }
  renderNormal () {
    return (
      <div style={{...styles.normalContainer, ...this.props.style}}>
        <div style={{...styles.textContainer, ...(this.props.shouldFollow ? {display: 'none'} : {})}}>
          <span style={styles.youShouldFollow}>You'll see this card every time you access the folder.</span>
        </div>
        <div onClick={() => this.props.followChecked(!this.props.shouldFollow)}>
          <i style={styles.check} className={`fa ${this.props.shouldFollow ? 'fa-check-square-o' : 'fa-square-o'}`}></i>
          <span style={styles.track}>Track</span>
          <i style={styles.eye} className='fa fa-eye'></i>
        </div>
        <FlatButton style={styles.primary} label='Close' primary onTouchTap={() => this.props.onClose()} />
      </div>
    )
  }
}

ActionRender.propTypes = {
  state: React.PropTypes.oneOf([normal, warning, error]).isRequired,
  username: React.PropTypes.string.isRequired,
  shouldFollow: React.PropTypes.bool.isRequired,
  onClose: React.PropTypes.func.isRequired,
  onRefollow: React.PropTypes.func.isRequired,
  onUnfollow: React.PropTypes.func.isRequired,
  onFollowHelp: React.PropTypes.func.isRequired,
  followChecked: React.PropTypes.func.isRequired,
  style: React.PropTypes.object.isRequired
}

const button = {
  borderRadius: 61,
  color: 'white',
  fontSize: 18,
  fontWeight: 'normal',
  height: 32,
  lineHeight: '32px',
  textTransform: 'none',
  width: 123
}

const styles = {
  normalContainer: {
    ...commonStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: 'white',
    justifyContent: 'flex-end',
    paddingLeft: 15,
    paddingRight: 15
  },
  textContainer: {
    ...commonStyles.flexBoxRow,
    justifyContent: 'center',
    marginRight: 15,
    flex: 1,
    fontSize: 13,
    lineHeight: '17px'
  },
  youShouldFollow: {
    ...commonStyles.noSelect,
    color: '#858596',
    maxWidth: 182,
    textAlign: 'center'
  },
  changedMessage: {
    ...commonStyles.noSelect,
    ...commonStyles.fontBold,
    color: '#4444',
    textAlign: 'center'
  },
  check: {
    marginRight: 3,
    width: 17
  },
  track: {
    color: '#444444',
    fontSize: 15,
    marginRight: 3
  },
  eye: {
    color: '#444444',
    marginRight: 17,
    width: 14
  },
  primary: {
    ...button,
    backgroundColor: '#86e2f9'
  },
  secondary: {
    ...button,
    backgroundColor: '#ffa9a9',
    marginRight: 7
  },
  flagWarning: {
    color: '#f5a623',
    width: 20
  },
  flagError: {
    color: '#d0021b',
    width: 20
  }
}
