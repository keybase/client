import React, {Component} from 'react'
import {LinkingIOS, StyleSheet, Text, View} from 'react-native'
import commonStyles from '../../styles/common'
import Button from '../../common-adapters/button'

export default class WelcomeRender extends Component {
  render () {
    return (
      <View style={[styles.container, {marginTop: 64, marginBottom: 48}]}>
        <Text style={[commonStyles.h1, {padding: 20, textAlign: 'center'}]}>Welcome to Keybase</Text>
        <Button type='Secondary' onPress={() => this.props.onGotoLoginPage()}>
          <View>
            <Text style={commonStyles.h1}>Log in -</Text>
            <Text style={[commonStyles.h2, {marginBottom: 40}]}>Already a keybase user? Welcome back!</Text>
          </View>
        </Button>
        <Button type='Secondary' onPress={() => this.props.onGotoSignupPage()}>
          <View>
            <Text style={commonStyles.h1}>Sign up -</Text>
            <Text style={commonStyles.h2}>In order to sign up for our beta, a friend who is an existing member on Keybase is required to share a file with you</Text>
          </View>
        </Button>
        <View style={{flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 10}}>
          <Text style={commonStyles.h2}
            onPress={() => { LinkingIOS.openURL('https://github.com/keybase/keybase-issues') }}>Report a bug or problem</Text>
        </View>
      </View>
    )
  }
}

WelcomeRender.propTypes = {
  onGotoLoginPage: React.PropTypes.func.isRequired,
  onGotoSignupPage: React.PropTypes.func.isRequired,
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    marginLeft: 8,
    marginRight: 8,
  },
})
