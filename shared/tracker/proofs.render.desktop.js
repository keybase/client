/* @flow */

import React, {Component} from 'react'
import commonStyles from '../styles/common'
import {globalStyles, globalColors} from '../styles/style-guide'
import {Icon, Text, ProgressIndicator} from '../common-adapters/index'
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
    if (proof.state !== proofChecking) {
      proof.humanUrl && this.openLink(proof.humanUrl)
    }
  }

  onClickProfile (proof: Proof): void {
    console.log('Opening profile link:', proof)
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
      'web': 'fa-globe',
      'dns': 'fa-globe'
    }[proof.type]
  }

  metaColor (proof: Proof): string {
    let color = globalColors.blue
    switch (proof.meta) {
      case metaNew: color = globalColors.blue; break
      case metaUpgraded: color = globalColors.blue; break
      case metaUnreachable: color = globalColors.red; break
      case metaPending: color = globalColors.black40; break
      case metaDeleted: color = globalColors.red; break
    }
    return color
  }

  _isTracked (proof: Proof): boolean {
    return this.props.currentlyFollowing && (!proof.meta || proof.meta === metaNone)
  }

  proofColor (proof: Proof): string {
    let color = globalColors.blue
    switch (proof.state) {
      case proofNormal: {
        color = this._isTracked(proof) ? globalColors.green2 : globalColors.blue
        break
      }
      case proofChecking:
        color = globalColors.black20
        break
      case proofRevoked:
      case proofWarning:
      case proofError:
        color = globalColors.red
        break
    }

    if (proof.state === proofChecking) color = globalColors.black20

    return color
  }

  proofStatusIcon (proof: Proof): ?IconProps.type {
    switch (proof.state) {
      case proofNormal:
        return this._isTracked(proof) ? 'fa-custom-icon-proof-good-followed' : 'fa-custom-icon-proof-good-new'

      case proofWarning:
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
                <Text inline style={{...globalStyles.selectable, color: proofNameColor}} type='Body'>{proof.name}</Text>
              </span>
              <wbr/>
              <Text inline type='Body' style={styles.proofType}>@{proof.type}</Text>
            </span>
          {proof.meta && <Text type='Header' style={{...styles.meta, backgroundColor: metaColor}}>{proof.meta}</Text>}
          </div>
        </div>
        {isChecking &&
          <ProgressIndicator style={styles.loader} />
        }
        {!isChecking && proofStatusIcon &&
          <Icon type={proofStatusIcon} style={styles.statusIcon} onClick={() => this.onClickProof(proof)} />
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
    backgroundColor: globalColors.white
  },
  row: {
    ...globalStyles.flexBoxRow,
    paddingTop: 8,
    paddingLeft: 30,
    paddingRight: 30,
    alignItems: 'flex-start',
    justifyContent: 'flex-start'
  },
  service: {
    ...globalStyles.clickable,
    height: 14,
    width: 14,
    color: globalColors.black75,
    hoverColor: globalColors.black75,
    marginRight: 9,
    marginTop: 4
  },
  statusIcon: {
    ...globalStyles.clickable,
    fontSize: 20,
    marginLeft: 10
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
    flex: 1
  },
  proofName: {
    ...commonStyles.clickable,
    flex: 1
  },
  proofType: {
    color: globalColors.black10
  },
  meta: {
    color: globalColors.white,
    borderRadius: 1,
    fontSize: 10,
    height: 11,
    lineHeight: '11px',
    paddingLeft: 2,
    paddingRight: 2,
    alignSelf: 'flex-start',
    textTransform: 'uppercase'
  },
  serviceStatus: {
    ...globalStyles.clickable,
    marginTop: 1
  },
  loader: {
    width: 20
  }
}
