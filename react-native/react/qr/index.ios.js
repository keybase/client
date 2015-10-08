'use strict'
/* @flow */

import React, { Component, Image, StyleSheet, Text, View } from 'react-native'
import Camera from 'react-native-camera'
import commonStyles from '../styles/common'
import qrCode from 'qrcode-generator'
import Button from '../common-adapters/button'

const countMax = 10

export default class QR extends Component {
  constructor (props) {
    super(props)

    this.state = {
      scanning: false,
      readCode: null,
      countDown: countMax,
      code: this.getNextCode()
    }

    this.timerId = null
  }

  componentWillUnmount () {
    this.stopCountdown()
  }

  componentDidMount () {
    this.checkTimers()
  }

  componentDidUpdate () {
    this.checkTimers()
  }

  startCountdown () {
    if (this.timerId) {
      return
    }

    this.setState({
      countDown: countMax,
      generatedCodeImage: this.generateCodeImage()
    })

    this.timerId = setInterval(() => {
      this.countDown()
    }, 1000)
  }

  stopCountdown () {
    clearInterval(this.timerId)
    this.timerId = null
  }

  checkTimers () {
    if (this.state.scanning) {
      this.stopCountdown()
    } else {
      this.startCountdown()
    }
  }

  countDown () {
    let next = this.state.countDown - 1

    if (next === 0) {
      next = countMax
      this.setState({
        code: this.getNextCode(),
        generatedCodeImage: this.generateCodeImage()
      })
    }

    this.setState({countDown: next})
  }

  getNextCode () {
    return `hiya from code: ${Math.floor(Math.random() * 1000)}`
  }

  generateCodeImage () {
    if (!this.state.code) {
      return null
    }

    const qr = qrCode(10, 'L')
    qr.addData(this.state.code)
    qr.make()
    let tag = qr.createImgTag(10)
    const [, src, width, height] = tag.split(' ')
    const [, generatedCode,] = src.split('\"')
    console.log(tag)
    console.log(generatedCode)
    return generatedCode
  }

  render () {
    const scanSwitch =
      <View style={styles.switchContainer}>
        <Button
          style={styles.buttonContainer}
          onPress={() => this.setState({scanning: true, readCode: null})}
          buttonStyle={[commonStyles.actionButton, styles.actionButton]}
          title='Scan Code' />
        <Button
          style={styles.buttonContainer}
          onPress={() => this.setState({scanning: false})}
          buttonStyle={[commonStyles.actionButton, styles.actionButton]}
          title='Generate Code' />
      </View>

    if (this.state.scanning) {
      return (
        <Camera
          style={styles.camera}
          ref='cam'
          onBarCodeRead={({data}) => this.setState({readCode: data})}>
          <Text>{this.state.readCode}</Text>
          {scanSwitch}
        </Camera>
      )
    } else {
      return (
        <View style={styles.camera}>
          <View style={styles.qrContainer}>
            <Image style={{width: 300, height: 300}}source={{uri: this.state.generatedCodeImage}} />
            <Text>{this.state.countDown}</Text>
          </View>
          {scanSwitch}
        </View>
      )
    }
  }

  static parseRoute (store, currentPath, nextPath) {
    const componentAtTop = {
      title: 'QR',
      component: QR
    }

    return {
      componentAtTop,
      parseNextRoute: null
    }
  }
}

QR.propTypes = { }

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    marginTop: 60,
    marginBottom: 49
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    opacity: 0.4,
    padding: 10,
    height: 40
  },
  qrContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center'
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionButton: {
    marginLeft: 10,
    marginRight: 10
  }
})
