import * as ImagePicker from 'expo-image-picker'
import React, {PureComponent} from 'react'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {isIOS, isLargeScreen} from '../../../../constants/platform'
import {LayoutEvent} from '../../../../common-adapters/box'
import SetExplodingMessagePicker from '../../messages/set-explode-popup/container'
import Typing from './typing/container'
import FilePickerPopup from '../filepicker-popup'
import MoreMenuPopup from './moremenu-popup'
import {PlatformInputPropsInternal} from './platform-input'
import AddSuggestors, {standardTransformer} from '../suggestors'
import {parseUri, launchCameraAsync, launchImageLibraryAsync} from '../../../../util/expo-image-picker'
import {BotCommandUpdateStatus} from './shared'
import {formatDurationShort} from '../../../../util/timestamp'
import {indefiniteArticle} from '../../../../util/string'
import AudioRecorder from '../../../audio/audio-recorder.native'

type menuType = 'exploding' | 'filepickerpopup' | 'moremenu'

type State = {
  animatedExpanded: boolean
  animatedMaxHeight: Kb.NativeAnimated.Value
  expanded: boolean
  hasText: boolean
}

const {call, set, cond, timing, block, debug, Value, Clock} = Kb.ReAnimated
const {startClock, stopClock, clockRunning, not} = Kb.ReAnimated
const runTiming = (clock, from, dest, onDone) => {
  console.log('aaa run timing called', from, dest)
  // const clock = new Clock()

  const state = {
    finished: new Value(0),
    frameTime: new Value(0),
    position: new Value(0),
    time: new Value(0),
  }

  const config = {
    duration: 1000,
    easing: Kb.ReAnimatedEasing.inOut(Kb.ReAnimatedEasing.ease),
    toValue: new Value(0),
  }

  return block([
    cond(not(clockRunning(clock)), [
      debug('aaa clock init1', state.position),
      set(state.finished, 0),
      set(state.frameTime, 0),
      set(state.time, 0),
      set(state.position, from),
      set(config.toValue, dest),
      startClock(clock),
      // debug('aaa starting clock again', startClock(clock)),
    ]),
    timing(clock, state, config),
    cond(
      state.finished,
      [stopClock(clock), call([state.finished], onDone)],
      debug('aaa pos', state.position)
    ),
    state.position,
  ])
}
// const runSpring = (clock, value, dest) => {
// const state = {
// finished: new Value(0),
// position: new Value(0),
// time: new Value(0),
// velocity: new Value(0),
// }

// const config = {
// damping: 10,
// mass: 5,
// overshootClamping: false,
// restDisplacementThreshold: 0.001,
// restSpeedThreshold: 0.001,
// stiffness: 101.6,
// toValue: new Value(0),
// }

// return block([
// cond(clockRunning(clock), 0, [
// debug('clock init1', state.position),
// set(state.finished, 0),
// set(state.time, 0),
// set(state.position, value),
// set(state.velocity, -2500),
// set(config.toValue, dest),
// startClock(clock),
// ]),
// spring(clock, state, config),
// cond(state.finished, debug('aaaa stop clock', stopClock(clock))),
// state.position,
// ])
// }

const AnimatedBox2 = Kb.ReAnimated.createAnimatedComponent(Kb.Box2)

const minInputArea = 145

class _PlatformInput extends PureComponent<PlatformInputPropsInternal, State> {
  private input: null | Kb.PlainInput = null
  private lastText?: string
  private whichMenu?: menuType
  private clock = new Clock()
  // private anim: Kb.ReAnimated.Node<number> = new Value(minInputArea)
  private animateState = new Value(0) // 0 nothing, 1, up, -1 down

  private anim = runTiming(
    this.clock,
    minInputArea,
    this.props.maxInputArea ?? Styles.dimensionHeight,
    () => {} //this.setState({animatedExpanded: expanded})
  )

  state = {
    animatedExpanded: false, // updates after animations are done
    // animatedMaxHeight: new Kb.NativeAnimated.Value(Styles.dimensionHeight),
    expanded: false, // updates immediately, used for the icon etc
    hasText: false,
  }

  // componentDidUpdate(prevProps: PlatformInputPropsInternal) {
  // if (this.props.maxInputArea !== prevProps.maxInputArea) {
  // this.setState({
  // animatedMaxHeight: new Kb.NativeAnimated.Value(this.props.maxInputArea ?? Styles.dimensionHeight),
  // })
  // }
  // }

  private inputSetRef = (ref: null | Kb.PlainInput) => {
    this.input = ref
    this.props.inputSetRef(ref)
    // @ts-ignore this is probably wrong: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31065
    this.props.inputRef.current = ref
  }

  private openFilePicker = () => {
    this.toggleShowingMenu('filepickerpopup')
  }
  private openMoreMenu = () => {
    this.toggleShowingMenu('moremenu')
  }

  private launchNativeImagePicker = (mediaType: 'photo' | 'video' | 'mixed', location: string) => {
    const handleSelection = (result: ImagePicker.ImagePickerResult) => {
      if (result.cancelled === true || !this.props.conversationIDKey) {
        return
      }
      const filename = parseUri(result)
      if (filename) {
        this.props.onAttach([filename])
      }
    }

    switch (location) {
      case 'camera':
        launchCameraAsync(mediaType)
          .then(handleSelection)
          .catch(error => this.props.onFilePickerError(new Error(error)))
        break
      case 'library':
        launchImageLibraryAsync(mediaType)
          .then(handleSelection)
          .catch(error => this.props.onFilePickerError(new Error(error)))
        break
    }
  }

  private getText = () => {
    return this.lastText || ''
  }

  private onChangeText = (text: string) => {
    this.setState({hasText: !!text})
    this.lastText = text
    this.props.onChangeText(text)
  }

  private onSubmit = () => {
    const text = this.getText()
    if (text) {
      this.props.onSubmit(text)
    }
  }

  private toggleShowingMenu = (menu: menuType) => {
    // Hide the keyboard on mobile when showing the menu.
    Kb.NativeKeyboard.dismiss()
    this.whichMenu = menu
    this.props.toggleShowingMenu()
  }

  private onLayout = (p: LayoutEvent) => {
    const {nativeEvent} = p
    const {layout} = nativeEvent
    const {height} = layout
    this.props.setHeight(height)
  }

  private insertMentionMarker = () => {
    if (this.input) {
      const input = this.input
      input.focus()
      input.transformText(
        ({selection: {end, start}, text}) => standardTransformer('@', {position: {end, start}, text}, true),
        true
      )
    }
  }

  private getHintText = () => {
    let hintText = 'Write a message'
    if (this.props.isExploding && isLargeScreen) {
      hintText = 'Exploding message'
    } else if (this.props.isExploding && !isLargeScreen) {
      hintText = 'Exploding'
    } else if (this.props.isEditing) {
      hintText = 'Edit your message'
    } else if (this.props.cannotWrite) {
      hintText = `You must be at least ${indefiniteArticle(this.props.minWriterRole)} ${
        this.props.minWriterRole
      } to post.`
    }
    return hintText
  }

  private getMenu = () => {
    return this.props.showingMenu && this.whichMenu === 'filepickerpopup' ? (
      <FilePickerPopup
        attachTo={this.props.getAttachmentRef}
        visible={this.props.showingMenu}
        onHidden={this.props.toggleShowingMenu}
        onSelect={this.launchNativeImagePicker}
      />
    ) : this.whichMenu === 'moremenu' ? (
      <MoreMenuPopup
        conversationIDKey={this.props.conversationIDKey}
        onHidden={this.props.toggleShowingMenu}
        visible={this.props.showingMenu}
      />
    ) : (
      <SetExplodingMessagePicker
        attachTo={this.props.getAttachmentRef}
        conversationIDKey={this.props.conversationIDKey}
        onHidden={this.props.toggleShowingMenu}
        visible={this.props.showingMenu}
      />
    )
  }

  private expandInput = () => {
    const expanded = !this.state.expanded
    this.setState(s => ({expanded: !s.expanded}))
    // Kb.NativeAnimated.timing(this.state.animatedMaxHeight, {
    // toValue: !expanded ? 145 : this.props.maxInputArea ?? Styles.dimensionHeight,
    // }).start(() => {
    // this.setState({animatedExpanded: expanded})
    // })
    // startClock(this.clock)
    // this.anim = runSpring(this.clock, 150, 800)

    // const onDone = (...a) => {
    // console.log('aaa on done called', a)
    // this.setState({animatedExpanded: expanded})
    // }
    // startClock(this.clock)
    console.log('aaa expand input ', expanded)
    // startClock(this.clock)

    this.animateState.setValue(expand ? 1 : -1)
    // if (expanded) {
    // this.anim = runTiming(
    // // this.clock,
    // minInputArea,
    // this.props.maxInputArea ?? Styles.dimensionHeight,
    // onDone
    // )
    // } else {
    // this.anim = runTiming(
    // // this.clock,
    // this.props.maxInputArea ?? Styles.dimensionHeight,
    // minInputArea,
    // onDone
    // )
    // }
  }

  render() {
    console.log('aaa rerendering')
    const commandUpdateStatus = this.props.suggestBotCommandsUpdateStatus !==
      RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank &&
      (this.props.suggestionsVisible ||
        this.props.suggestBotCommandsUpdateStatus === RPCChatTypes.UIBotCommandsUpdateStatusTyp.updating) && (
        <BotCommandUpdateStatus status={this.props.suggestBotCommandsUpdateStatus} />
      )

    const explodingIcon = !this.props.isEditing && !this.props.cannotWrite && (
      <Kb.NativeTouchableWithoutFeedback onPress={() => this.toggleShowingMenu('exploding')}>
        <Kb.Box style={explodingIconContainer}>
          {this.props.isExploding ? (
            <Kb.Box2 direction="horizontal" style={styles.exploding} centerChildren={true}>
              <Kb.Text type="BodyTinyBold" negative={true}>
                {formatDurationShort(this.props.explodingModeSeconds * 1000)}
              </Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.Icon
              color={this.props.isExploding ? Styles.globalColors.black : null}
              type="iconfont-timer"
              fontSize={22}
            />
          )}
        </Kb.Box>
      </Kb.NativeTouchableWithoutFeedback>
    )

    const editing = this.props.isEditing && (
      <Kb.Box style={styles.editingTabStyle}>
        <Kb.Text type="BodySmall">Edit:</Kb.Text>
        <Kb.Text type="BodySmallPrimaryLink" onClick={this.props.onCancelEditing}>
          Cancel
        </Kb.Text>
      </Kb.Box>
    )

    return (
      <AnimatedBox2
        direction="vertical"
        onLayout={this.onLayout}
        fullWidth={true}
        style={this.state.animatedExpanded ? {height: this.anim} : {maxHeight: this.anim}}
      >
        {commandUpdateStatus}
        {this.getMenu()}
        {this.props.showTypingStatus && !this.props.suggestionsVisible && (
          <Typing conversationIDKey={this.props.conversationIDKey} />
        )}
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([styles.container, this.state.animatedExpanded && {height: '100%'}])}
          fullWidth={true}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputContainer}>
            {editing}
            <Kb.PlainInput
              autoCorrect={true}
              autoCapitalize="sentences"
              disabled={this.props.cannotWrite ?? false}
              placeholder={this.getHintText()}
              multiline={true}
              onBlur={this.props.onBlur}
              onFocus={this.props.onFocus}
              // TODO: Call onCancelQuoting on text change or selection
              // change to match desktop.
              onChangeText={this.onChangeText}
              onSelectionChange={this.props.onSelectionChange}
              ref={this.inputSetRef}
              style={styles.input}
              textType="Body"
              rowsMin={1}
            />
            <Kb.Icon
              padding="xtiny"
              onClick={this.expandInput}
              type={this.state.expanded ? 'iconfont-expand' : 'iconfont-collapse'}
              style={styles.expandIcon}
            />
          </Kb.Box2>
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            gap="small"
            alignItems="flex-end"
            style={styles.actionContainer}
          >
            {explodingIcon}
            <Kb.Icon onClick={this.insertMentionMarker} type="iconfont-mention" />
            <Kb.Icon onClick={this.openFilePicker} type="iconfont-camera" />
            <AudioRecorder conversationIDKey={this.props.conversationIDKey} />
            <Kb.Icon onClick={this.openMoreMenu} type="iconfont-add" />
            <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexGrow} />
            <Kb.Button
              type="Default"
              small={true}
              onClick={this.onSubmit}
              disabled={!this.state.hasText}
              label={this.props.isEditing ? 'Save' : 'Send'}
            />
          </Kb.Box2>
        </Kb.Box2>
      </AnimatedBox2>
    )
  }
}
const PlatformInput = AddSuggestors(_PlatformInput)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      accessory: {
        bottom: 1,
        display: 'flex',
        left: 0,
        position: 'absolute',
        right: 0,
      },
      accessoryContainer: {
        position: 'relative',
        width: '100%',
      },
      actionContainer: {
        flexShrink: 0,
      },
      actionText: {
        alignSelf: 'flex-end',
        paddingBottom: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.tiny,
      },
      animatedContainer: {
        bottom: 0,
        position: 'absolute',
        right: 0,
      },
      container: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.fastBlank,
        borderTopColor: Styles.globalColors.black_10,
        borderTopWidth: 1,
        flexShrink: 1,
        maxHeight: '100%',
        minHeight: 1,
        overflow: 'hidden',
        padding: Styles.globalMargins.tiny,
      },
      editingTabStyle: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        backgroundColor: Styles.globalColors.yellowLight,
        flexShrink: 0,
        height: '100%',
        minWidth: 32,
        padding: Styles.globalMargins.xtiny,
      },
      expandIcon: {
        marginTop: Styles.globalMargins.xtiny,
      },
      exploding: {
        backgroundColor: Styles.globalColors.black,
        borderRadius: Styles.globalMargins.mediumLarge / 2,
        height: Styles.globalMargins.mediumLarge,
        marginLeft: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
        width: Styles.globalMargins.mediumLarge,
      },
      explodingOuterContainer: {
        alignSelf: 'flex-end',
        paddingBottom: isIOS ? 7 : 10,
      },
      input: Styles.platformStyles({
        common: {
          flex: 1,
          marginRight: Styles.globalMargins.tiny,
        },
        isAndroid: {
          // This is to counteract some intrinsic margins the android view has
          marginTop: -8,
        },
      }),
      inputContainer: {
        flexGrow: 1,
        flexShrink: 1,
        maxHeight: '100%',
        paddingBottom: Styles.globalMargins.tiny,
      },
      marginRightSmall: {
        marginRight: Styles.globalMargins.small,
      },
      mentionHud: {
        borderColor: Styles.globalColors.black_20,
        borderTopWidth: 1,
        flex: 1,
        height: 160,
        width: '100%',
      },
      smallGap: {
        height: Styles.globalMargins.small,
        width: Styles.globalMargins.small,
      },
    } as const)
)

// Use manual gap when Kb.Box2 is inserting too many (for children that deliberately render nothing)
const smallGap = <Kb.Box style={styles.smallGap} />

const explodingIconContainer = {
  ...Styles.globalStyles.flexBoxColumn,
}

export default Kb.OverlayParentHOC(PlatformInput)
