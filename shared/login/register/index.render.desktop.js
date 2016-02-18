// @flow
import React, {Component} from 'react'
import {globalStyles, globalColorsDZ2, transition} from '../../styles/style-guide'
import {Icon, Text} from '../../common-adapters'
import Container from '../forms/container.desktop'

const Row = ({onClick, icon, title, subTitle, children, style}) => {
  return (
    <div className='register-row' style={{...styles.rowContainer, ...style}} onClick={onClick}>
      <div className='register-icon' style={styles.iconContainer}>
        <div className='register-background' style={styles.iconBackground}/>
        <Icon type={icon} style={styles.icon}/>
      </div>
      <div>
        <Text dz2 type='Header' inline={false} style={styles.header}>{title}</Text>
        <Text dz2 type='Body' small>{subTitle}</Text>
        {children}
      </div>
    </div>
  )
}

export default class RegisterRender extends Component {
  render () {
    const realCSS = `
      .register-row { background-color: ${globalColorsDZ2.white}; }
      .register-row:hover { background-color: ${globalColorsDZ2.blue4}; }

      .register-row:hover .register-icon { transform: translateX(15px)}

      .register-row .register-background { background-color: ${globalColorsDZ2.lightGrey2}; }
      .register-row:hover .register-background { background-color: ${globalColorsDZ2.blue4}; transform: scale(0)}
    `

    return (
      <Container onBack={() => this.props.onBack()} >
        <style>{realCSS}</style>
        <Row
          style={styles.firstRow}
          icon='fa-custom-key'
          title='Connect your PGP key'
          subTitle='If your PGP key is on the Keybase server, we can sign you in right away.'>
          <div style={styles.instantContainer}>
            <Icon type='fa-bolt' style={styles.instantIcon}/>
            <Text dz2 type='Body' style={styles.instant} small>Instant</Text>
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
  header: {
    color: globalColorsDZ2.blue
  },
  rowContainer: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.clickable,
    ...transition('background'),
    minHeight: 100,
    maxHeight: 100,
    alignItems: 'center',
    padding: 20
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
  },
  iconContainer: {
    ...globalStyles.flexBoxRow,
    ...transition('transform'),
    maxWidth: 80,
    maxHeight: 80,
    minWidth: 80,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 25,
    position: 'relative'
  },
  icon: {
    fontSize: 35,
    textAlign: 'center',
    height: 'inherit',
    width: 'inherit',
    color: globalColorsDZ2.black75,
    zIndex: 1
  },
  iconBackground: {
    ...transition('background', 'transform'),
    borderRadius: 40,
    maxWidth: 80,
    maxHeight: 80,
    minWidth: 80,
    minHeight: 80,
    position: 'absolute',
    top: 0,
    left: 0
  }
}
