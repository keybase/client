// @flow
import React, {Component} from 'react'
import {NativeStyleSheet, Text, NativeTouchableHighlight, Box} from '../../common-adapters/index.native'

// TODO redo this screen with style guide
const commonStyles = {}

class ExistingDeviceRender extends Component {
  render () {
    return (
      <Box style={[styles.container, {marginTop: 200, padding: 20, alignItems: 'stretch'}]}>
        <Text type='Body' style={commonStyles.h1}>What type of device would you like to connect this device with?</Text>
        <Box style={{flex: 1, flexDirection: 'row', marginTop: 40, justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 40, paddingRight: 40}}>
          <NativeTouchableHighlight onPress={() => this.props.onSubmitComputer()}>
            <Box style={{flexDirection: 'column', alignItems: 'center'}}>
              <Text type='Body'>[Desktop icon]</Text>
              <Text type='Body'>Desktop Device &gt;</Text>
            </Box>
          </NativeTouchableHighlight>
          <NativeTouchableHighlight onPress={() => this.props.onSubmitPhone()}>
            <Box style={{flexDirection: 'column', alignItems: 'center'}}>
              <Text type='Body'>[Mobile icon]</Text>
              <Text type='Body'>Mobile Device &gt;</Text>
            </Box>
          </NativeTouchableHighlight>
        </Box>
      </Box>
    )
  }
}

ExistingDeviceRender.propTypes = {
  onSubmitComputer: React.PropTypes.func.isRequired,
  onSubmitPhone: React.PropTypes.func.isRequired,

}

const styles = NativeStyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start',
  },
})

export default ExistingDeviceRender
