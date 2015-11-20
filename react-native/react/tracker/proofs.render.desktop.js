import React, {Component} from '../base-react'
import commonStyles, {colors} from '../styles/common'

// TODO const when integrating
const verified = 'verified'
const checking = 'checking'
const deleted = 'deleted'
const unreachable = 'unreachable'
const pending = 'pending'

export default class ProofsRender extends Component {
  openLink (proof, platform) {
    window.open(platform ? proof.platformLink : proof.proofLink)
  }

  metaColor (pp) {
    return {
      'new': colors.orange,
      deleted: colors.red,
      unreachable: colors.red,
      pending: colors.grey
    }[pp.proof.meta]
  }

  tempStatus (pp) {
    return {
      verified: '[v]',
      checking: '[c]',
      deleted: '[d]',
      unreachable: '[u]',
      pending: '[p]'
    }[pp.proof.status]
  }

  renderPlatformProof (pp) {
    const name = pp.platform.name === 'web' ? pp.platform.uri : pp.platform.username

    const icon = {
      '[TW]': 'fa-twitter',
      '[GH]': 'fa-github',
      '[re]': 'fa-reddit',
      '[pgp]': 'fa-key',
      '[cb]': 'fa-btc',
      '[web]': 'fa-globe'
    }[pp.platform.icon]

    const statusColor = {
      verified: colors.lightBlue,
      checking: colors.grey,
      deleted: colors.orange,
      unreachable: colors.orange,
      pending: colors.orange
    }[pp.proof.status]

    return (
      <div style={styles.row}>
        <i style={styles.platform} className={'fa ' + icon} title={name} onTouchTap={() => this.openLink(pp.platform.uri)}></i>
        <div style={styles.usernameContainer}>
          <span
            style={{...styles.username, ...{textDecoration: pp.proof.status === deleted ? 'line-through' : 'inherit'}}}
            onTouchTap={() => this.openLink(pp.platform.uri)}>{name}</span>
          {pp.proof.meta && <span style={{...styles.meta, backgroundColor: this.metaColor(pp)}}>{pp.proof.meta}</span>}
        </div>
        <span className='fa fa-certificate' style={{...styles.status, color: statusColor}} onTouchTap={() => this.openLink(pp.proof.uri)}></span>
      </div>
    )
  }

  render () {
    return (
      <div style={styles.container}>
        <div styles={styles.userContainer}>
          <span>keybase.io/</span>
          <span style={styles.keybaseUsername}>{this.props.username}</span>
        </div>
        <div style={styles.hr}></div>
        { this.props.platformProofs && this.props.platformProofs.map(platformProof => this.renderPlatformProof(platformProof)) }
      </div>
    )
  }
}

ProofsRender.propTypes = {
  platformProofs: React.PropTypes.arrayOf(React.PropTypes.shape({
    platform: React.PropTypes.shape({
      icon: React.PropTypes.string.isRequired,
      name: React.PropTypes.string,
      username: React.PropTypes.string,
      uri: React.PropTypes.string
    }).isRequired,
    proof: React.PropTypes.shape({
      title: React.PropTypes.string,
      uri: React.PropTypes.string,
      status: React.PropTypes.oneOf([verified, checking, deleted, unreachable, pending]).isRequired,
      meta: React.PropTypes.string
    }).isRequired
  })).isRequired,
  username: React.PropTypes.string.isRequired
}

const styles = {
  container: {
    ...commonStyles.flexBoxColumn,
    backgroundColor: 'white',
    border: '5px solid ' + colors.greyBackground,
    borderLeft: 0,
    borderRight: 0,
    paddingLeft: 25,
    paddingTop: 15,
    paddingRight: 26,
    flex: 1,
    overflowY: 'auto'
  },
  userContainer: {
    fontSize: 15
  },
  keybaseUsername: {
    ...commonStyles.fontBold,
    color: colors.orange
  },
  hr: {
    ...commonStyles.hr,
    width: 41,
    margin: '12px 0 0 0'
  },
  row: {
    ...commonStyles.flexBoxRow,
    flex: 1,
    lineHeight: '21px',
    marginTop: 10,
    alignItems: 'flex-start',
    justifyContent: 'flex-start'
  },
  platform: {
    height: 16,
    width: 16,
    color: '#444444',
    marginRight: 12
  },
  usernameContainer: {
    ...commonStyles.flexBoxColumn,
    alignItems: 'flex-start',
    flex: 1,
    lineHeight: '15px'
  },
  meta: {
    ...commonStyles.fontBold,
    color: 'white',
    fontSize: 9,
    height: 13,
    lineHeight: '13px',
    marginTop: 2,
    paddingLeft: 4,
    paddingRight: 4,
    textTransform: 'uppercase'
  },
  username: {
    ...commonStyles.clickable,
    color: colors.lightBlue
  },
  status: {
    ...commonStyles.clickable
  }
}

