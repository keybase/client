// @flow
import React, {Component} from 'react'
import {TouchableWithoutFeedback, Picker} from 'react-native'
import Box from './box'
import Text from './text'
import {globalColors, globalMargins, globalStyles} from '../styles'
import FloatingBox from './floating-box.native'

type PickerItem = {label: string, value: string | number}

type Props<T: string | number> = {
  items: PickerItem[], // values must be unique
  selectedValue: T,
  onSelect: T => void,
  header?: React.Node,
  prompt?: React.Node,
  onHidden: () => void,
  onCancel: () => void,
  onDone: () => void,
  visible: boolean,
}

const FloatingPicker = (props: Props) => {
  if (!props.visible) {
    return null
  }
  return (
    <FloatingBox>
      <TouchableWithoutFeedback style={styleOverlayContainer} onPress={props.onHidden}>
        <Box style={styleOverlay}>
          <Box style={{...styleMenu, ...props.style}}>
            {props.header}
            <Box style={styleActionButtons}>
              <Box style={{flex: 1}}>
                <Text
                  type="BodySemibold"
                  style={{color: globalColors.blue, fontSize: 17}}
                  onClick={props.onCancel}
                >
                  Cancel
                </Text>
              </Box>
              <Text
                type="BodySemibold"
                style={{color: globalColors.blue, fontSize: 17}}
                onClick={props.onDone}
              >
                Done
              </Text>
            </Box>
            <Picker
              selectedValue={props.selectedValue}
              onValueChange={(itemValue, itemIndex) => props.onSelect(itemValue)}
            >
              {props.items.map(item => <Picker.Item key={item.label} {...item} />)}
            </Picker>
          </Box>
        </Box>
      </TouchableWithoutFeedback>
    </FloatingBox>
  )
}

const styleOverlayContainer = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
}

const styleOverlay = {
  ...styleOverlayContainer,
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-end',
  alignItems: 'stretch',
  backgroundColor: globalColors.black_40,
}

const styleMenu = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-end',
  alignItems: 'stretch',
  backgroundColor: globalColors.white,
}

const styleActionButtons = {
  ...globalStyles.flexBoxRow,
  padding: globalMargins.small,
  width: '100%',
  height: 56,
  justifyContent: 'flex-end',
  alignItems: 'stretch',
}

export {FloatingPicker}
