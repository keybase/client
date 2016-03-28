/* @flow */

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../../../styles/style-guide'
import {Text, Button, Checkbox, Icon} from '../../../common-adapters'
import {specialStyles as textStyles} from '../../../common-adapters/text'
import Container from '../../forms/container'

import type {Props} from './index.render'

export default class Render extends Component {
  props: Props;

  state: {
    inWallet: boolean
  };

  constructor (props: Props) {
    super(props)
    this.state = {inWallet: false}
  }

  render () {
    return (
      <Container onBack={this.props.onBack} style={styles.container}>
        <Text type='Header' style={styles.header}>{this.props.title || 'Congratulations, you’ve just joined Keybase!'}</Text>
        <Text type='Body' style={styles.body}>Here is your unique paper key, it will allow you to perform important Keybase tasks in the future. This is the only time you’ll see this so be sure to write it down.</Text>
        <div style={styles.paperKeyContainer}>
          <Text type='Body' style={styles.paperkey}>{this.props.paperkey.stringValue()}</Text>
          <Icon type='paper-key-corner' style={styles.paperCorner}/>
        </div>
        <Checkbox style={styles.check} label='Yes, I wrote this down.' checked={this.state.inWallet} onCheck={inWallet => this.setState({inWallet})} />
        <Button style={styles.button} type='Primary' label='Done' onClick={() => this.props.onFinish()} disabled={!this.state.inWallet} />
      </Container>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    marginTop: 15
  },
  header: {
    marginTop: 22,
    marginBottom: 5
  },
  body: {
    paddingLeft: 15,
    paddingRight: 15,
    marginBottom: 35,
    textAlign: 'center'
  },
  paperKeyContainer: {
    position: 'relative',
    width: 400,
    marginBottom: 35,
    paddingTop: 12,
    paddingLeft: 30,
    paddingRight: 45,
    borderRadius: 1,
    backgroundColor: globalColors.white,
    border: `solid 4px ${globalColors.darkBlue}`
  },
  paperCorner: {
    position: 'absolute',
    top: -4,
    right: -4
  },
  check: {
    marginBottom: 60
  },
  button: {
    alignSelf: 'flex-end'
  },
  paperkey: {
    ...textStyles.paperKey,
    ...globalStyles.selectable,
    marginBottom: 15,
    display: 'inline-block'
  }
}
