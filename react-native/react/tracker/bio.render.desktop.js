import React, {Component} from '../base-react'
import {Paper} from 'material-ui'

import commonStyles, {colors} from '../styles/common'

// TODO constants when integrating
const normal = 'normal'
const warning = 'warning'
const error = 'error'

export default class BioRender extends Component {
  render () {
    return (
      <div style={styles.container}>
        <Paper style={styles.avatar} zDepth={1} circle>
          <img src={this.props.avatar} style={styles.avatar}/>
        </Paper>
        {this.props.followsYou && <span style={styles.followsYou}>Tracks you</span>}
        <p style={styles.fullname}>{this.props.fullname}</p>
        <p style={styles.location}>{this.props.location}</p>
        <p style={styles.following}>Tracking: {this.props.followingCount}</p>
        <p style={styles.followers}>Trackers: {this.props.followersCount}</p>
      </div>
    )
  }
}

BioRender.propTypes = {
  state: React.PropTypes.oneOf([normal, warning, error]).isRequired,
  avatar: React.PropTypes.string.isRequired,
  username: React.PropTypes.string.isRequired,
  fullname: React.PropTypes.string.isRequired,
  followersCount: React.PropTypes.number.isRequired,
  followingCount: React.PropTypes.number.isRequired,
  followsYou: React.PropTypes.bool.isRequired,
  location: React.PropTypes.string.isRequired
}

const styles = {
  container: {
    ...commonStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: colors.greyBackground,
    justifyContent: 'flex-start',
    paddingTop: 12,
    width: 202
  },
  avatar: {
    border: '3px solid #cccccc',
    height: 100,
    minHeight: 100,
    overflow: 'hidden',
    width: 100
  },
  followsYou: {
    ...commonStyles.fontBold,
    backgroundColor: '#CCCCCC',
    color: '#4A4A4A',
    width: 70,
    height: 12,
    fontSize: 9,
    lineHeight: '12px',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: -10
  },
  fullname: {
    ...commonStyles.fontBold,
    color: colors.lightBlue,
    fontSize: 18,
    lineHeight: '22px',
    margin: 0,
    marginTop: 4,
    textAlign: 'center'
  },
  location: {
    fontSize: 13,
    color: '#8283A3',
    lineHeight: '17px',
    margin: 0,
    marginTop: 4
  },
  following: {
    color: colors.lightBlue,
    fontSize: 13,
    lineHeight: '16px',
    margin: 0,
    marginTop: 4
  },
  followers: {
    color: colors.lightBlue,
    fontSize: 13,
    lineHeight: '16px',
    margin: 0,
    marginTop: 4
  }
}
