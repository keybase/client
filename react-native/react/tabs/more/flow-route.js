'use strict'

import React, { Component, View, Text } from 'react-native'
import { routeAppend } from '../../actions/router'
import Button from '../../common-adapters/button'

const FlowComponentProps = {
  onNext: React.PropTypes.func.isRequired,
  onError: React.PropTypes.func.isRequired
}

class A extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text style={{textAlign: 'center'}}> A </Text>
        <Button onPress={this.props.onNext}>
          <Text>Next Step</Text>
        </Button>
      </View>
    )
  }
}

A.propTypes = FlowComponentProps

class B extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text style={{textAlign: 'center'}}> B </Text>
        <Button onPress={this.props.onNext}>
          <Text>Next Step</Text>
        </Button>
        <Button onPress={this.props.onError}>
          <Text>Fail!</Text>
        </Button>
      </View>
    )
  }
}

B.propTypes = FlowComponentProps

class C extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text style={{textAlign: 'center'}}> C </Text>
      </View>
    )
  }
}

C.propTypes = FlowComponentProps

class D extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text style={{textAlign: 'center'}}> D </Text>
      </View>
    )
  }
}

D.propTypes = FlowComponentProps

function ComponentPromise (dispatch) {
  return (component, mapStateToProps) => {
    return () => {
      return new Promise((resolve, reject) => {
        dispatch(routeAppend({
          path: component,
          mapStateToProps: (state) => {
            return Object.assign({
              onNext: resolve,
              onError: reject
            },
            mapStateToProps && mapStateToProps(state))
          }
        }))
      })
    }
  }
}

export default class FlowDemo extends Component {
  componentWillMount () {
    const { componentPromise } = this.props
    componentPromise(A)()
      .then(componentPromise(B))
      .catch(componentPromise(D))
      .then(componentPromise(C))
  }

  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text style={{textAlign: 'center'}}> Loading Flow Demo... </Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath, uri) {
    const lastPath = uri.last()

    if (lastPath === currentPath) {
      return {
        componentAtTop: {
          mapStateToProps: () => { return {componentPromise: ComponentPromise(store.dispatch)} },
          title: 'Flow Demo'
        }
      }
    }

    return {
      componentAtTop: {
        component: lastPath.get('path'),
        mapStateToProps: lastPath.get('mapStateToProps'),
        hideNavBar: true
      }
    }
  }
}

FlowDemo.propTypes = {
  componentPromise: React.PropTypes.func.isRequired
}
