// @flow
import React, {type Node} from 'react'
import {TouchableWithoutFeedback, Picker} from 'react-native'
import Box, {Box2} from './box'
import Text from './text'
import {globalColors, globalMargins, globalStyles} from '../styles'
import FloatingBox from './floating-box.native'

type PickerItem = {label: string, value: string | number}

type Props = {
  items: PickerItem[], // values must be unique
  selectedValue: string | number,
  onSelect: (string | number) => void,
  header?: Node,
  prompt?: Node,
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
    // onHidden required by the typing for desktop, not used on mobile
    <FloatingBox onHidden={() => {}}>
      <TouchableWithoutFeedback style={styleOverlayContainer} onPress={props.onHidden}>
        <Box style={styleOverlay}>
          <Box2 direction="vertical" fullWidth={true} style={styleMenu}>
            {props.header}
            <Box2
              direction="horizontal"
              gap="small"
              gapStart={true}
              gapEnd={true}
              fullWidth={true}
              style={styleActionButtons}
            >
              <Text
                type="BodySemibold"
                style={{color: globalColors.blue, fontSize: 17, flex: 1}}
                onClick={props.onCancel}
              >
                Cancel
              </Text>
              <Text
                type="BodySemibold"
                style={{color: globalColors.blue, fontSize: 17}}
                onClick={props.onDone}
              >
                Done
              </Text>
            </Box2>
            <Picker
              selectedValue={props.selectedValue}
              onValueChange={(itemValue, itemIndex) => props.onSelect(itemValue)}
            >
              {props.items.map(item => <Picker.Item key={item.label} {...item} />)}
            </Picker>
          </Box2>
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
  justifyContent: 'flex-end',
  alignItems: 'stretch',
  backgroundColor: globalColors.white,
}

const styleActionButtons = {
  paddingBottom: globalMargins.small,
  paddingTop: globalMargins.small,
  height: 56,
  justifyContent: 'flex-end',
  alignItems: 'stretch',
}

export {FloatingPicker}
