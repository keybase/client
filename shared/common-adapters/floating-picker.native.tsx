import * as Styles from '../styles'
import {SafeAreaView} from 'react-native'
import {Picker} from '@react-native-picker/picker'
import {Box2} from './box'
import Overlay from './overlay'
import Text from './text'
import type {Props} from './floating-picker'

// NOTE: this doesn't seem to work well when debugging w/ chrome. aka if you scroll and set a value the native component will undo it a bunch and its very finnicky. works fine outside of that it seems
const FloatingPicker = <T extends string | number>(props: Props<T>) => {
  if (!props.visible) {
    return null
  }

  return (
    <Overlay
      key={
        // Android bug: after selecting a new value (e.g. in
        // set-explode-popup), it flips to the new value, then back to the old
        // value, then to the new value. There is also a user report claiming
        // it flips forever. So just force remounting when the selected avlue
        // changes as a hacky fix.
        Styles.isAndroid ? props.selectedValue || 0 : undefined
      }
      onHidden={props.onHidden}
    >
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
          onValueChange={itemValue => props.onSelect(itemValue)}
          prompt={props.promptString}
          style={styles.picker}
          itemStyle={styles.item}
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionButtons: {
        alignItems: 'stretch',
        height: 56,
        justifyContent: 'flex-end',
      },
      flexOne: {
        flex: 1,
      },
      item: {
        ...Styles.globalStyles.fontRegular,
        color: Styles.globalColors.black,
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
          color: Styles.globalColors.black,
          marginBottom: Styles.globalMargins.large,
          marginTop: Styles.globalMargins.medium,
        },
      }),
      safeArea: {
        backgroundColor: Styles.globalColors.white,
      },
    } as const)
)

export default FloatingPicker
