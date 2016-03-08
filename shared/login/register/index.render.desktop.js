// @flow
import React, {Component} from 'react'
import {globalStyles, globalColorsDZ2} from '../../styles/style-guide'
import {Icon, Text} from '../../common-adapters'
import Container from '../forms/container.desktop'
import Row, {RowCSS} from './row'

export default class RegisterRender extends Component {
  render () {
    return (
      <Container onBack={() => this.props.onBack()} >
        <RowCSS />
        <Row
          style={styles.firstRow}
          icon='fa-custom-key'
          title='Connect your PGP key'
          subTitle='If your PGP key is on the Keybase server, we can sign you in right away.'
          onClick={() => { console.log('TODO') }}>
          <div style={styles.instantContainer}>
            <Icon type='fa-bolt' style={styles.instantIcon}/>
            <Text type='Body' style={styles.instant} small>Instant</Text>
          </div>
        </Row>
        <Row
          icon='phone-oblique'
          title='Connect another device'
          subTitle='Connect this computer with one of your existing devices.'
          onClick={() => { this.props.onGotoExistingDevicePage() }}/>
        <Row
          icon='paper-key'
          title='Connect your paper key'
          subTitle=''
          onClick={() => { this.props.onGotoPaperKeyPage() }}/>
        <Row
          icon='user-card'
          title='Use your username and passphrase'
          subTitle=''
          onClick={() => { this.props.onGotoUserPassPage() }}/>
      </Container>
    )
  }
}

RegisterRender.propTypes = {
  onGotoExistingDevicePage: React.PropTypes.func.isRequired,
  onGotoPaperKeyPage: React.PropTypes.func.isRequired,
  onGotoUserPassPage: React.PropTypes.func.isRequired,
  onBack: React.PropTypes.func.isRequired
}

const styles = {
  firstRow: {
    marginTop: 20
  },
  instantContainer: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center'
  },
  instant: {
    color: globalColorsDZ2.green2
  },
  instantIcon: {
    color: globalColorsDZ2.green2,
    width: 12
  }
}
