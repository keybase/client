import * as React from 'react'
import * as Styles from '../styles'
import {Picker, SafeAreaView} from 'react-native'
import {Box2} from './box'
import Overlay from './overlay'
import Text from './text'
import {Props} from './floating-picker'

const FloatingPicker = <T extends string | number>(props: Props<T>) => {
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
          onValueChange={(itemValue) => props.onSelect(itemValue)}
          prompt={props.promptString}
          style={styles.picker}
          itemStyle={Styles.globalStyles.fontRegular}
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
  actionButtons: {
    alignItems: 'stretch',
    height: 56,
    justifyContent: 'flex-end',
  },
  flexOne: {
    flex: 1,
  },
  link: {
    color: Styles.globalColors.blueDark,
    fontSize: 17,
    padding: Styles.globalMargins.small,
  },
  menu: {
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.white,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.black_50,
    justifyContent: 'flex-end',
  },
  overlayContainer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  picker: Styles.platformStyles({
    isAndroid: {
      marginBottom: Styles.globalMargins.large,
      marginTop: Styles.globalMargins.medium,
    },
  }),
  safeArea: {
    backgroundColor: Styles.globalColors.white,
  },
})

export default FloatingPicker
