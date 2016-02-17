// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors, transition} from '../../styles/style-guide'
import {Icon, Text} from '../../common-adapters'
import Container from '../forms/container.desktop'

const Row = ({onClick, icon, title, subTitle, children, style}) => {
  return (
    <div className='register-row' style={{...styles.rowContainer, ...style}} onClick={onClick}>
      <div className='register-icon' style={styles.iconContainer}>
        <Icon type={icon} style={styles.icon}/>
      </div>
      <div>
        <Text type='Header'>{title}</Text>
        <Text type='Body' small>{subTitle}</Text>
        {children}
      </div>
    </div>
  )
}

export default class RegisterRender extends Component {
  render () {
    const realCSS = `
      .register-row { background-color: ${globalColors.white}; }
      .register-row:hover { background-color: ${globalColors.blue}; }

      .register-row .register-icon { background-color: ${globalColors.grey4}; }
      .register-row:hover .register-icon { background-color: ${globalColors.blue}; transform: translateX(25px); }
    `

    return (
      <Container onBack={() => this.props.onBack()} >
        <style>{realCSS}</style>
        <Row
          style={styles.firstRow}
          icon='fa-key'
          title='Connect your PGP key'
          subTitle='If your PGP key is on the Keybase server, we can sign you in right away.'>
          <div style={styles.instantContainer}>
            <Icon type='fa-bolt' style={styles.instantIcon}/>
            <Text type='Body' small style={styles.instant}>Instant</Text>
          </div>
        </Row>
        <Row
          icon='fa-mobile'
          title='Connect another device'
          subTitle='Connect this computer with one of your existing devices.'
          onClick={() => { this.props.onGotoExistingDevicePage() }}/>
        <Row
          icon='fa-file-text-o'
          title='Connect your paper key'
          subTitle=''
          onClick={() => { this.props.onGotoPaperKeyPage() }}/>
        <Row
          icon='fa-user'
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
  rowContainer: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.clickable,
    ...transition('background'),
    minHeight: 100,
    maxHeight: 100,
    alignItems: 'center',
    marginBottom: 10,
    padding: 20
  },
  instantContainer: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center'
  },
  iconContainer: {
    ...globalStyles.flexBoxRow,
    ...transition('transform', 'background'),
    maxWidth: 80,
    maxHeight: 80,
    minWidth: 80,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 25,
    borderRadius: 40
  },
  instantIcon: {
    color: globalColors.green
  },
  instant: {
    color: globalColors.green
  },
  icon: {
    fontSize: 50,
    width: 50,
    height: 50,
    textAlign: 'center'
  }
}
