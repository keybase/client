/* @flow */

import React, {Component} from 'react'
import commonStyles, {colors} from '../styles/common'
import {globalStyles, globalColors} from '../styles/style-guide'
import {Icon} from '../common-adapters/index'
import {checking, revoked} from '../constants/tracker'
import {metaNew, metaUpgraded, metaUnreachable, metaPending, metaDeleted} from '../constants/tracker'
import electron from 'electron'
import flags from '../util/feature-flags'

const shell = electron.shell || electron.remote.shell

import type {Proof, ProofsProps} from './proofs.render'

export default class ProofsRender extends Component {
  props: ProofsProps;

  openLink (url: string): void {
    shell.openExternal(url)
  }

  renderProofRow (styles: any, proof: Proof): ReactElement {
    const metaColor = proof.meta ? {
      [metaNew]: colors.orange,
      [metaUpgraded]: colors.orange,
      [metaUnreachable]: colors.orange,
      [metaPending]: colors.orange,
      [metaDeleted]: colors.orange
    }[proof.meta] : null

    const onClickProof = () => {
      if (proof.state !== checking) {
        console.log('should open hint link:', proof.humanUrl)
        proof.humanUrl && this.openLink(proof.humanUrl)
      } else {
        console.log('Proof is loading...')
      }
    }

    const onClickProfile = () => {
      if (proof.state !== checking) {
        console.log('should open profile link:', proof.profileUrl)
        proof.profileUrl && this.openLink(proof.profileUrl)
      } else {
        console.log('Proof is loading...')
      }
    }

    const icon = {
      'twitter': 'fa-twitter',
      'github': 'fa-github',
      'reddit': 'fa-reddit',
      'pgp': 'fa-key',
      'coinbase': 'fa-btc',
      'hackernews': 'fa-hacker-news',
      'rooter': 'fa-shopping-basket',
      'web': 'fa-globe'
    }[proof.type]

    const statusColor = {
      normal: colors.lightBlue,
      loggedOut: colors.lightBlue,
      checking: colors.grey,
      revoked: colors.orange,
      warning: colors.orange,
      error: colors.red,
      // FIXME: the four below states will never be rendered; this is a hack
      // to keep flow happy.  Will go away when tracker v1 goes away.
      followed: colors.lightBlue,
      unfollowed: colors.lightBlue,
      refollowed: colors.lightBlue,
      followedProofsAdded: colors.lightBlue
    }[proof.state]

    return (
      <div style={styles.row} key={proof.id}>
        <Icon style={styles.service} type={icon} title={proof.type} onClick={onClickProfile} />
        <div style={styles.proofNameContainer}>
          <span
            className='hover-underline'
            style={{...styles.proofName, ...(proof.state === revoked ? {textDecoration: 'line-through'} : {})}}
            onClick={onClickProfile}>
            {proof.name}
          </span>
          {proof.meta && <span style={{...styles.meta, backgroundColor: metaColor}}>{proof.meta}</span>}
        </div>
        <span className='fa fa-certificate hover-underline' style={{...styles.serviceStatus, color: statusColor}} onClick={onClickProof}></span>
      </div>
    )
  }

  onClickUsername () {
    shell.openExternal(`https://keybase.io/${this.props.username}`)
  }

  render (): ReactElement {
    if (flags.tracker2) {
      return this.render2(styles2)
    }
    return this.renderDefault(styles1)
  }

  renderDefault (styles: Object): ReactElement {
    return (
      <div style={styles.container}>
        <div styles={styles.userContainer}>
          <span>keybase.io/</span>
          <span className='hover-underline' onClick={() => this.onClickUsername()} style={styles.keybaseUsername}>{this.props.username}</span>
        </div>
        <div style={styles.hr}></div>
        {this.props.proofs.map(p => this.renderProofRow(styles, p))}
      </div>
    )
  }

  render2 (styles: Object): ReactElement {
    return (
      <div style={styles.container}>
        {this.props.proofs.map(p => this.renderProofRow(styles, p))}
      </div>
    )
  }
}

ProofsRender.propTypes = {
  proofs: React.PropTypes.any,
  username: React.PropTypes.string.isRequired
}

const styles1 = {
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
    ...commonStyles.clickable,
    color: colors.orange
  },
  hr: {
    ...commonStyles.hr,
    width: 41,
    margin: '12px 0 0 0'
  },
  row: {
    ...commonStyles.flexBoxRow,
    lineHeight: '21px',
    marginTop: 10,
    alignItems: 'flex-start',
    justifyContent: 'flex-start'
  },
  service: {
    height: 16,
    width: 16,
    color: '#444444',
    marginRight: 12
  },
  proofNameContainer: {
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
  proofName: {
    ...commonStyles.clickable,
    color: colors.lightBlue
  },
  status: {
    ...commonStyles.clickable
  }
}

const styles2 = {
  container: {
    ...globalStyles.flexBoxColumn,
    paddingLeft: 30,
    paddingRight: 30,
    backgroundColor: globalColors.white
  },
  row: {
    ...globalStyles.flexBoxRow,
    marginTop: 12,
    alignItems: 'flex-start',
    justifyContent: 'flex-start'
  },
  service: {
    height: 14,
    width: 14,
    color: globalStyles.grey1,
    marginRight: 11,
    marginTop: 1
  },
  proofNameContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    flex: 1,
    ...globalStyles.singleLine
  },
  meta: {
    ...globalStyles.fontBold,
    color: 'white',
    fontSize: 9,
    height: 13,
    lineHeight: '13px',
    marginTop: 2,
    paddingLeft: 4,
    paddingRight: 4,
    textTransform: 'uppercase'
  },
  proofName: {
    ...globalStyles.clickable,
    color: globalColors.blue
  },
  serviceStatus: {
    ...globalStyles.clickable,
    marginTop: 1
  }
}
