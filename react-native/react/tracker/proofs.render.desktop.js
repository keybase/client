/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
import commonStyles, {colors} from '../styles/common'

import {error, pending} from '../constants/tracker'
import type {SimpleProofState} from '../constants/tracker'

export type Proof = {
  id: string,
  type: string,
  state: SimpleProofState,
  humanUrl: ?string,
  name: string,
  color: string
}

export type ProofsProps = {
  proofs: Array<Proof>
}

export default class ProofsRender extends Component {
  props: ProofsProps;

  // TODO hook this up
  openLink (url: string): void {
    window.open(url)
  }

  renderProofRow (proof: Proof): ReactElement {
    const metaColor = {
      'new': colors.orange,
      deleted: colors.red,
      unreachable: colors.red,
      pending: colors.grey
    }[proof.meta]

    const onTouchTap = () => {
      if (proof.state !== pending) {
        console.log('should open hint link:', proof.humanUrl)
        proof.humanUrl && this.openLink(proof.humanUrl)
      } else {
        console.log('Proof is loading...')
      }
    }

    const icon = {
      '[TW]': 'fa-twitter',
      '[GH]': 'fa-github',
      '[re]': 'fa-reddit',
      '[pgp]': 'fa-key',
      '[cb]': 'fa-btc',
      '[web]': 'fa-globe'
    }[proof.type]

    const statusColor = {
      verified: colors.lightBlue,
      checking: colors.grey,
      deleted: colors.orange,
      unreachable: colors.orange,
      pending: colors.orange
    }[proof.status]

    return (
      <div style={styles.row}>
        <i style={styles.platform} className={'fa ' + icon} title={proof.type} onTouchTap={onTouchTap}></i>
        <div style={styles.usernameContainer}>
          <span
            style={{...styles.username, ...{textDecoration: proof.status === 'deleted' ? 'line-through' : 'inherit'}}} /* deleted not in model? */
            onTouchTap={onTouchTap}>{proof.name}</span>
          {proof.meta && <span style={{...styles.meta, backgroundColor: metaColor}}>{proof.meta}</span>}
        </div>
        <span className='fa fa-certificate' style={{...styles.status, color: statusColor}} onTouchTap={onTouchTap}></span>
      </div>
    )
  }

  render (): ReactElement {
    return (
      <div style={styles.container}>
        <div styles={styles.userContainer}>
          <span>keybase.io/</span>
          <span style={styles.keybaseUsername}>{this.props.username}</span>
        </div>
        <div style={styles.hr}></div>
        {this.props.proofs.map(p => this.renderProofRow(p))}
      </div>
    )
  }
}

ProofsRender.propTypes = {
  proofs: React.PropTypes.any,
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

