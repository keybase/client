/* @flow */

import React, {Component} from 'react'
import {View, Text} from 'react-native'

import openUrl from '../util/open-url'
import * as shared from './user-proofs.shared'
import {metaNone} from '../constants/tracker'
import {Icon, Meta} from '../common-adapters/index'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {checking as proofChecking} from '../constants/tracker'

import type {Props, Proof} from './user-proofs'

export default class ProofsRender extends Component {
  props: Props;

  _onClickProof (proof: Proof): void {
    if (proof.state !== proofChecking) {
      proof.humanUrl && openUrl(proof.humanUrl)
    }
  }

  _onClickProfile (proof: Proof): void {
    console.log('Opening profile link:', proof)
    if (proof.state !== proofChecking) {
      proof.profileUrl && openUrl(proof.profileUrl)
    }
  }

  _renderProofRow (proof: Proof, idx: number) {
    const metaBackgroundColor = shared.metaColor(proof)
    const proofStatusIconType = shared.proofStatusIcon(proof)
    const proofNameStyle = shared.proofNameStyle(proof)
    const onClickProfile = () => { this._onClickProfile(proof) }

    const proofStyle = {
      ...globalStyles.selectable,
      width: 208,
      ...styles.proofName,
    }

    const meta = proof.meta && proof.meta !== metaNone && <Meta title={proof.meta} style={{backgroundColor: metaBackgroundColor}} />

    const proofIcon = proofStatusIconType && <Icon type={proofStatusIconType} style={styles.statusIcon} onClick={() => this._onClickProof(proof)} />

    return (
      <View style={{...styles.row, paddingTop: idx > 0 ? 8 : 0}} key={`${proof.id}${proof.type}`}>
        <Icon style={styles.service} type={shared.iconNameForProof(proof)} title={proof.type} onClick={onClickProfile} />
        <View style={styles.proofNameSection}>
          <View style={styles.proofNameLabelContainer}>
            <Text inline className='hover-underline-container' type='Body' onClick={onClickProfile} style={proofStyle}>
              <Text inline type='Body' className='underline' style={proofNameStyle}>{proof.name}</Text>
              <Text className='no-underline' inline type='Body' style={styles.proofType}>@{proof.type}</Text>
            </Text>
            {meta}
          </View>
        </View>
        {proofIcon}
      </View>
    )
  }

  render () {
    return (
      <View style={styles.container}>
        {this.props.proofs.map((p, idx) => this._renderProofRow(p, idx))}
      </View>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.white,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  row: {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  service: {
    ...globalStyles.clickable,
    fontSize: 15,
    marginTop: 2,
    width: 15,
    textAlign: 'center',
    color: globalColors.black_75,
    marginRight: globalMargins.tiny,
  },
  statusIcon: {
    ...globalStyles.clickable,
    fontSize: 20,
    marginLeft: 10,
    marginTop: 1,
  },
  proofNameSection: {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    flex: 1,
  },
  proofNameLabelContainer: {
    ...globalStyles.flexBoxColumn,
    flex: 1,
  },
  proofName: {
    ...globalStyles.clickable,
    flex: 1,
  },
  proofType: {
    color: globalColors.black_10,
  },
}
