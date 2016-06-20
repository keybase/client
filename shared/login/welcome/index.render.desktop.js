import React, {Component} from 'react'
import commonStyles from '../../styles/common'
import shell from 'shell'
import {Button} from '../../common-adapters'

export default class WelcomeRender extends Component {
  render () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'flex-start', marginLeft: 8, marginRight: 8, marginTop: 64, marginBottom: 48, padding: 40}}>
        <h1 style={[commonStyles.h1, {padding: 20, textAlign: 'center'}]}>Welcome to Keybase</h1>
        <Button type='Secondary' style={{marginBottom: 20}} onClick={() => this.props.onGotoLoginPage()}>
          <span style={commonStyles.h1}>Log in -</span>
          <span style={[commonStyles.h2, {marginBottom: 40}]}>Already a keybase user? Welcome back!</span>
        </Button>
        <Button type='Secondary' style={{marginBottom: 20}} onClick={() => this.props.onGotoSignupPage()}>
          <span style={commonStyles.h1}>Sign up -</span>
          <span style={commonStyles.h2}>In order to sign up for our beta, a friend who is an existing member on Keybase is required to share a file with you</span>
        </Button>
        <div style={{display: 'flex', flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 10}}>
          <h2 style={{...commonStyles.h2, ...commonStyles.clickable}}
            onClick={() => { shell.openExternal('https://github.com/keybase/keybase-issues') }}>Report a bug or problem</h2>
        </div>
      </div>
    )
  }
}

WelcomeRender.propTypes = {
  onGotoLoginPage: React.PropTypes.func.isRequired,
  onGotoSignupPage: React.PropTypes.func.isRequired,
}
