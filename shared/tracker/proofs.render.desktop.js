/* @flow */

import React, {Component} from 'react'
import commonStyles, {colors} from '../styles/common'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import {Icon} from '../common-adapters/index'
import {CircularProgress} from 'material-ui'
import {normal as proofNormal, checking as proofChecking, revoked as proofRevoked, error as proofError, warning as proofWarning} from '../constants/tracker'
import {metaNew, metaUpgraded, metaUnreachable, metaPending, metaDeleted, metaNone} from '../constants/tracker'
import electron from 'electron'

import type {Props as IconProps} from '../common-adapters/icon'

const shell = electron.shell || electron.remote.shell

import type {Proof, ProofsProps} from './proofs.render'

export class ProofsRender2 extends Component {
  props: ProofsProps;

  openLink (url: string): void {
    shell.openExternal(url)
  }

  onClickProof (proof: Proof): void {
    // TODO: State is deprecated, will refactor after nuking v1
    if (proof.state !== proofChecking) {
      proof.humanUrl && this.openLink(proof.humanUrl)
    }
  }

  onClickProfile (proof: Proof): void {
    console.log('Opening profile link:', proof)
    // TODO: State is deprecated, will refactor after nuking v1
    if (proof.state !== proofChecking) {
      proof.profileUrl && this.openLink(proof.profileUrl)
    }
  }

  onClickUsername () {
    shell.openExternal(`https://keybase.io/${this.props.username}`)
  }

  iconNameForProof (proof: Proof): IconProps.type {
    return {
      'twitter': 'fa-twitter',
      'github': 'fa-github',
      'reddit': 'fa-reddit',
      'pgp': 'fa-key',
      'coinbase': 'fa-btc',
      'hackernews': 'fa-hacker-news',
      'rooter': 'fa-shopping-basket',
      'web': 'fa-globe'
    }[proof.type]
  }

  metaColor (proof: Proof): string {
    let color = globalColorsDZ2.blue
    switch (proof.meta) {
      case metaNew: color = globalColorsDZ2.blue; break
      case metaUpgraded: color = globalColorsDZ2.blue; break
      case metaUnreachable: color = globalColorsDZ2.red; break
      case metaPending: color = globalColorsDZ2.orange; break
      case metaDeleted: color = globalColorsDZ2.red; break
    }
    return color
  }

  proofColor (proof: Proof): string {
    let color = globalColorsDZ2.blue
    let tracked = this.props.currentlyFollowing && (!proof.meta || proof.meta === metaNone)
    switch (proof.state) {
      case proofNormal: {
        color = tracked ? globalColorsDZ2.green : globalColorsDZ2.blue
        break
      }
      case proofChecking:color = color = '#999'; break
      case proofRevoked: color = globalColorsDZ2.red; break
      case proofWarning: color = globalColorsDZ2.orange; break
      case proofError: color = globalColorsDZ2.red; break
    }

    // TODO: State is deprecated, will refactor after nuking v1
    if (proof.state === proofChecking) color = '#999'

    return color
  }

  renderProofRow (styles: Object, proof: Proof) {
    const metaColor = this.metaColor(proof)
    const proofNameColor = this.proofColor(proof)
    const onClickProfile = () => { this.onClickProfile(proof) }
    // TODO: State is deprecated, will refactor after nuking v1
    let isChecking = (proof.state === proofChecking)
    return (
      <div style={styles.row} key={proof.id}>
        <Icon style={styles.service} type={this.iconNameForProof(proof)} title={proof.type} onClick={onClickProfile} />
        <div style={styles.proofNameSection}>
          <div style={styles.proofNameContainer}>
            <span
              style={{...styles.proofName, ...(proof.meta === metaDeleted ? {textDecoration: 'line-through'} : {}), color: proofNameColor}}
              onClick={onClickProfile}>
              {proof.name}
            </span>
            <span style={styles.proofType}>@{proof.type}</span>
          </div>
          {proof.meta && <span style={{...styles.meta, backgroundColor: metaColor}}>{proof.meta}</span>}
        </div>
        {isChecking &&
          <CircularProgress style={styles.loader} mode='indeterminate' color='#999' size={0.2} />
        }
        {!isChecking &&
          <Icon type='fa-certificate' style={{...styles.serviceStatus, color: proofNameColor}} onClick={onClickProfile} />
        }
      </div>
    )
  }

  render () {
    return (
      <div style={styles2.container}>
        {this.props.proofs.map(p => this.renderProofRow(styles2, p))}
      </div>
    )
  }
}

const styles2 = {
  container: {
    ...globalStyles.flexBoxColumn
  },
  row: {
    ...globalStyles.flexBoxRow,
    paddingTop: 12,
    paddingLeft: 30,
    paddingRight: 30,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    backgroundColor: globalColorsDZ2.orange.white,
    zIndex: 1
  },
  service: {
    height: 14,
    width: 14,
    color: globalColors.grey1,
    marginRight: 11,
    marginTop: 1
  },
  proofNameSection: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    flex: 1
  },
  proofNameContainer: {
    ...globalStyles.flexBoxRow,
    flexWrap: 'wrap',
    alignItems: 'flex-start'
  },
  proofName: {
    // TODO: This doesn't ellipsis since the proof names are a single word,
    // using word-wrap or text-wrap doesn't work either. We should try
    // interspersing blank whitespace to wrap on
    // ...lineClamp(1)
  },
  proofType: {
    color: globalColorsDZ2.lightGrey
  },
  meta: {
    ...globalStyles.fontBold,
    color: globalColorsDZ2.white,
    fontSize: 9,
    height: 13,
    lineHeight: '13px',
    marginTop: 2,
    paddingLeft: 4,
    paddingRight: 4,
    textTransform: 'uppercase'
  },
  serviceStatus: {
    marginTop: 1
  },
  loader: {
    // Using negative margins cause we can't override height for CircularProgress
    marginTop: -18,
    marginBottom: -16,
    marginLeft: -16,
    marginRight: -16
  }
}

export class ProofsRender extends Component {
  props: ProofsProps;

  openLink (url: string): void {
    shell.openExternal(url)
  }

  renderProofRow (styles: any, proof: Proof) {
    const metaColor = proof.meta ? {
      [metaNew]: colors.orange,
      [metaUpgraded]: colors.orange,
      [metaUnreachable]: colors.orange,
      [metaPending]: colors.orange,
      [metaDeleted]: colors.orange
    }[proof.meta] : null

    const onClickProof = () => {
      if (proof.state !== proofChecking) {
        console.log('should open hint link:', proof.humanUrl)
        proof.humanUrl && this.openLink(proof.humanUrl)
      } else {
        console.log('Proof is loading...')
      }
    }

    const onClickProfile = () => {
      if (proof.state !== proofChecking) {
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
      error: colors.red
    }[proof.state]

    return (
      <div style={styles.row} key={proof.id}>
        <Icon style={styles.service} type={icon} title={proof.type} onClick={onClickProfile} />
        <div style={styles.proofNameContainer}>
          <span
            className='hover-underline'
            style={{...styles.proofName, ...(proof.state === proofRevoked ? {textDecoration: 'line-through'} : {})}}
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

  render () {
    const styles = styles1
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
