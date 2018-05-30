// @flow
import * as React from 'react'
import {TouchableWithoutFeedback, Picker} from 'react-native'
import Box, {Box2} from './box'
import Text from './text'
import {
  globalColors,
  globalMargins,
  globalStyles,
  platformStyles,
  styleSheetCreate,
  collapseStyles,
} from '../styles'
import FloatingBox from './floating-box.native'

type PickerItem = {|label: string, value: string | number|}

type Props = {
  items: PickerItem[], // values must be unique
  selectedValue: string | number,
  onSelect: (string | number) => void,
  header?: React.Node,
  prompt?: React.Node,
  promptString?: string, // used on android as title of selection popup
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
      <TouchableWithoutFeedback style={styles.overlayContainer} onPress={props.onHidden}>
        <Box style={[styles.overlayContainer, styles.overlay]}>
          <Box2 direction="vertical" fullWidth={true} style={styles.menu}>
            {props.header}
            <Box2
              direction="horizontal"
              gap="small"
              gapStart={true}
              gapEnd={true}
              fullWidth={true}
              style={styles.actionButtons}
            >
              <Text
                type="BodySemibold"
                style={collapseStyles([styles.link, styles.cancelContainer])}
                onClick={props.onCancel}
              >
                Cancel
              </Text>
              <Text type="BodySemibold" style={styles.link} onClick={props.onDone}>
                Done
              </Text>
            </Box2>
            {props.prompt}
            <Picker
              selectedValue={props.selectedValue}
              onValueChange={(itemValue, itemIndex) => props.onSelect(itemValue)}
              prompt={props.promptString}
              style={styles.picker}
            >
              {props.items.map(item => <Picker.Item key={item.label} {...item} />)}
            </Picker>
          </Box2>
        </Box>
      </TouchableWithoutFeedback>
    </FloatingBox>
  )
}

const styles = styleSheetCreate({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  overlay: {
    ...globalStyles.flexBoxColumn,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    backgroundColor: globalColors.black_40,
  },
  menu: {
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    backgroundColor: globalColors.white,
  },
  cancelContainer: {
    flex: 1,
  },
  link: {
    color: globalColors.blue,
    fontSize: 17,
  },
  actionButtons: {
    paddingBottom: globalMargins.small,
    paddingTop: globalMargins.small,
    height: 56,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  picker: platformStyles({
    isAndroid: {
      marginBottom: globalMargins.large,
      marginTop: globalMargins.medium,
    },
  }),
})

export {FloatingPicker}
