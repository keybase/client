// @flow
import * as React from 'react'
import * as Styles from '../styles'
import {Picker, SafeAreaView} from 'react-native'
import {Box2} from './box'
import Overlay from './overlay'
import Text from './text'

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
    <Overlay onHidden={props.onHidden}>
      <Box2 direction="vertical" fullWidth={true} style={styles.menu}>
        {props.header}
        <Box2 direction="horizontal" fullWidth={true} style={styles.actionButtons}>
          <Text type="BodySemibold" style={styles.link} onClick={props.onCancel}>
            Cancel
          </Text>
          <Box2 direction="horizontal" style={styles.flexOne} />
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
          {props.items.map(item => (
            <Picker.Item key={item.label} {...item} />
          ))}
        </Picker>
        <SafeAreaView style={styles.safeArea} />
      </Box2>
    </Overlay>
  )
}

const styles = Styles.styleSheetCreate({
  safeArea: {
    backgroundColor: Styles.globalColors.white,
  },
  flexOne: {
    flex: 1,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  overlay: {
    ...Styles.globalStyles.flexBoxColumn,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.black_40,
  },
  menu: {
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.white,
  },
  link: {
    color: Styles.globalColors.blue,
    fontSize: 17,
    padding: Styles.globalMargins.small,
  },
  actionButtons: {
    height: 56,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  picker: Styles.platformStyles({
    isAndroid: {
      marginBottom: Styles.globalMargins.large,
      marginTop: Styles.globalMargins.medium,
    },
  }),
})

export {FloatingPicker}
