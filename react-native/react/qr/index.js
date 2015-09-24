'use strict'
/* @flow */

const React = require('react-native')
const {
  Component,
  Image,
  StyleSheet,
  Text,
  TouchableHighlight,
  View
} = React

const Camera = require('react-native-camera')
const commonStyles = require('../styles/common')
const qrCode = require('qrcode-generator')
const countMax = 10

class QR extends Component {
  constructor (props) {
    super(props)

    this.state = {
      scanning: false,
      readCode: null,
      countDown: countMax,
      code: this.getNextCode()
    }

    this.state.generatedCodeImage = this.generateCodeImage()
  }

  componentDidMount () {
    clearInterval(this.state.timerId)
    this.state.timerId = setInterval(() => {
      this.countDown()
    }, 1000)
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
        <TouchableHighlight
          style={styles.buttonContainer}
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => this.setState({scanning: true, readCode: null})}>
          <Text style={[commonStyles.actionButton, styles.actionButton]}>Scan Code</Text>
        </TouchableHighlight>
        <TouchableHighlight
          style={styles.buttonContainer}
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => this.setState({scanning: false})}>
          <Text style={[commonStyles.actionButton, styles.actionButton]}>Generate Code</Text>
        </TouchableHighlight>
      </View>

    if (this.state.scanning) {
      return (
        <Camera
          style={styles.camera}
          ref='cam'
          onBarCodeRead={({data}) => this.setState({readCode: data})}
          type={Camera.constants.Type.back}>
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
}

QR.propTypes = {
  navigator: React.PropTypes.object
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    marginTop: 60
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

module.exports = QR
