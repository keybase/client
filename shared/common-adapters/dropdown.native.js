// @flow
import React, {Component} from 'react'
import {TouchableWithoutFeedback, Picker, Modal} from 'react-native'
import {globalStyles, globalColors} from '../styles/style-guide'
import Text from './text'
import Box from './box'
import Icon from './icon'
import type {Props} from './dropdown'

class Dropdown extends Component {
  state: {
    pickerVisible: boolean,
    value: ?string
  };

  constructor (props: Props) {
    super(props)
    this.state = {
      pickerVisible: false,
      value: this.props.value
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    this.setState({value: nextProps.value})
  }

  _showPicker (show: boolean) {
    this.setState({pickerVisible: show})

    if (show) {
      if (!this.state.value && this.props.options && this.props.options.length) {
        this.setState({value: this.props.options[0]})
      }
    } else {
      if (!this.state.value && this.props.onOther) {
        this.props.onOther()
      } else if (this.props.onClick) {
        this.props.onClick(this.state.value, (this.props.options || []).indexOf(this.state.value))
      }
    }
  }

  _itemStyle (): Object {
    return this.props.type === 'Username' ? {color: globalColors.orange} : {}
  }

  _otherLabel (): string {
    return this.props.type === 'Username' ? 'Someone else...' : 'Or something else'
  }

  render () {
    return (
      <TouchableWithoutFeedback onPress={() => this._showPicker(true)}>
        <Box style={{...styleContainer, ...this.props.style}}>
          <Modal animated transparent visible={this.state.pickerVisible} onRequestClose={() => this._showPicker(false)}>
            <Box style={stylePickerContainer}>
              <TouchableWithoutFeedback onPress={() => this._showPicker(false)}>
                <Box style={{flex: 1}}/>
              </TouchableWithoutFeedback>
              <Picker
                style={stylePicker}
                selectedValue={this.state.value}
                onValueChange={value => this.setState({value})} >
                {(this.props.options || []).map(o => (
                  <Picker.Item key={o} label={o} value={o} />
                )).concat(this.props.onOther ? (
                  <Picker.Item key='otherItemValue' label={this._otherLabel()} value='' />) : []
                )}
              </Picker>
            </Box>
          </Modal>
          <Text type='Header' style={{...styleText, ...this._itemStyle()}}>{this.state.value || 'Pick an option'}</Text>
          <Icon type='fa-caret-down' style={styleIcon}/>
        </Box>
      </TouchableWithoutFeedback>
    )
  }
}
const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderRadius: 100,
  width: 329,
  height: 40,
  paddingLeft: 17,
  paddingRight: 17,
  borderWidth: 1,
  borderColor: globalColors.black10
}

const styleText = {
  flex: 1,
  textAlign: 'center'
}

const styleIcon = {
  width: 20
}

const stylePickerContainer = {
  flex: 1,
  justifyContent: 'flex-end',
  backgroundColor: globalColors.black40
}

const stylePicker = {
  backgroundColor: globalColors.white
}

export default Dropdown
