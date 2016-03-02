/* @flow */

import React, {Component} from 'react'
import commonStyles from '../styles/common'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import {Icon, Text} from '../common-adapters/index'
import {CircularProgress} from 'material-ui'
import {normal as proofNormal, checking as proofChecking, revoked as proofRevoked, error as proofError, warning as proofWarning} from '../constants/tracker'
import {metaNew, metaUpgraded, metaUnreachable, metaPending, metaDeleted, metaNone} from '../constants/tracker'
import electron from 'electron'

import type {Props as IconProps} from '../common-adapters/icon'

const shell = electron.shell || electron.remote.shell

import type {Proof, ProofsProps} from './proofs.render'

export class ProofsRender extends Component {
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

  _isTracked (proof: Proof): boolean {
    return this.props.currentlyFollowing && (!proof.meta || proof.meta === metaNone)
  }

  proofColor (proof: Proof): string {
    let color = globalColorsDZ2.blue
    switch (proof.state) {
      case proofNormal: {
        color = this._isTracked(proof) ? globalColorsDZ2.green : globalColorsDZ2.blue
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

  proofStatusIcon (proof: Proof): ?IconProps.type {
    switch (proof.state) {
      case proofNormal:
        return this._isTracked(proof) ? 'fa-custom-icon-proof-good-followed' : 'fa-custom-icon-proof-good-new'

      case proofError:
      case proofRevoked:
        return 'fa-custom-icon-proof-broken'
      default:
        return null
    }
  }

  renderProofRow (styles: Object, proof: Proof) {
    const metaColor = this.metaColor(proof)
    const proofNameColor = this.proofColor(proof)
    const proofStatusIcon = this.proofStatusIcon(proof)
    const onClickProfile = () => { this.onClickProfile(proof) }
    // TODO: State is deprecated, will refactor after nuking v1
    let isChecking = (proof.state === proofChecking)
    return (
      <div style={styles.row} key={proof.id}>
        <Icon style={styles.service} type={this.iconNameForProof(proof)} title={proof.type} onClick={onClickProfile} />
        <div style={styles.proofNameSection}>
          <div style={styles.proofNameLabelContainer}>
            <span style={styles.proofNameContainer}>
              <span
                className='hover-underline'
                style={{...styles.proofName, ...(proof.meta === metaDeleted ? {textDecoration: 'line-through'} : {}), color: proofNameColor}}
                onClick={onClickProfile}>
                <Text inline style={{color: proofNameColor}} type='Body'>{proof.name}</Text>
              </span>
              <wbr/>
              <Text inline type='Body' style={styles.proofType}>@{proof.type}</Text>
            </span>
          {proof.meta && <Text type='Header' style={{...styles.meta, backgroundColor: metaColor}}>{proof.meta}</Text>}
          </div>
        </div>
        {isChecking &&
          <CircularProgress style={styles.loader} mode='indeterminate' color='#999' size={0.2} />
        }
        {!isChecking && proofStatusIcon &&
          <Icon type={proofStatusIcon} style={{...globalStyles.clickable, fontSize: 20}} onClick={onClickProfile} />
        }
      </div>
    )
  }

  render () {
    return (
      <div style={styles.container}>
        {this.props.proofs.map(p => this.renderProofRow(styles, p))}
      </div>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColorsDZ2.white
  },
  row: {
    ...globalStyles.flexBoxRow,
    paddingTop: 12,
    paddingLeft: 30,
    paddingRight: 30,
    alignItems: 'flex-start',
    justifyContent: 'flex-start'
  },
  service: {
    ...globalStyles.clickable,
    height: 14,
    width: 14,
    color: globalColors.grey1,
    marginRight: 9,
    marginTop: 4
  },
  proofNameSection: {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    flex: 1
  },
  proofNameLabelContainer: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },
  proofNameContainer: {
    wordWrap: 'break-word',
    marginRight: 15,
    flex: 1
  },
  proofName: {
    ...commonStyles.clickable,
    flex: 1
  },
  proofType: {
    color: globalColorsDZ2.black10
  },
  meta: {
    color: globalColorsDZ2.white,
    fontSize: 10,
    height: 13,
    lineHeight: '13px',
    marginTop: 2,
    paddingLeft: 4,
    paddingRight: 4,
    alignSelf: 'flex-start',
    textTransform: 'uppercase'
  },
  serviceStatus: {
    ...globalStyles.clickable,
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
