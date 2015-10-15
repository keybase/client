'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View } from 'react-native'

import { codePageRolePhone1, codePageRolePhone2, codePageRoleComputer1, codePageRoleComputer2 } from '../../../constants/login2'
import commonStyles from '../../../styles/common'

export default class CodePage extends Component {
  render () {
    return (
      <View style={[styles.container, {marginTop: 200, padding: 20, alignItems: 'stretch'}]}>
        <Text style={commonStyles.h1}>{this.props.myRole + ':' + this.props.otherRole}</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = { }

    const componentAtTop = {
      title: '',
      component: CodePage,
      leftButtonTitle: '',
      mapStateToProps: state => state.login2.codePage
    }

    // Default the next route to the login form
    const parseNextRoute = routes[nextPath.get('path')]

    return {
      componentAtTop,
      parseNextRoute
    }
  }

}

CodePage.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  myRole: React.PropTypes.oneOf([codePageRolePhone1, codePageRolePhone2, codePageRoleComputer1, codePageRoleComputer2]),
  otherRole: React.PropTypes.oneOf([codePageRolePhone1, codePageRolePhone2, codePageRoleComputer1, codePageRoleComputer2])
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start'
  }
})

