import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {namedConnect} from '../../../util/container'
import {appendNewChatBuilder} from '../../../actions/typed-routes'
import * as Constants from '../../../constants/chat2'
import Flags from '../../../util/feature-flags'

type OwnProps = {
  hide: boolean
  onNewChat: () => void
}

const _HeaderNewChatButton = (props: OwnProps) => {
  if (props.hide) {
    return null
  }
  return Flags.wonderland ? (
    <Kb.Box style={styles.wonderlandButtonContainer}>
      <Kb.Box2 direction="vertical" style={styles.gradientContainer}>
        <Kb.Box style={styles.gradientRed} />
        <Kb.Box style={styles.gradientOrange} />
        <Kb.Box style={styles.gradientYellow} />
        <Kb.Box style={styles.gradientGreen} />
      </Kb.Box2>
      <Kb.Button
        label={'New chat 🐇'}
        mode="Primary"
        onClick={props.onNewChat}
        small={true}
        style={styles.wonderlandButton}
        type="Default"
      />
    </Kb.Box>
  ) : (
    <Kb.Button label={'New chat'} onClick={props.onNewChat} small={true} style={styles.button} />
  )
}

const HeaderNewChatButton = namedConnect(
  state => ({
    hide:
      state.chat2.inboxHasLoaded &&
      !state.chat2.metaMap.some((_, id) => Constants.isValidConversationIDKey(id)),
  }),
  dispatch => ({
    onNewChat: () => dispatch(appendNewChatBuilder()),
  }),
  (stateProps, dispatchProps) => ({...stateProps, ...dispatchProps}),
  'HeaderNewChatButton'
)(_HeaderNewChatButton)

const styles = Styles.styleSheetCreate({
  button: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.tiny,
  },
  gradientContainer: {flex: 1, height: 36, left: 0, position: 'absolute', top: 0, width: '100%'},
  gradientGreen: Styles.platformStyles({
    common: {
      backgroundColor: '#3AFFAC',
      borderBottomLeftRadius: Styles.borderRadius,
      borderBottomRightRadius: Styles.borderRadius,
      flex: 1,
    },
    isAndroid: {
      borderBottomLeftRadius: Styles.globalMargins.tiny,
      borderBottomRightRadius: Styles.globalMargins.tiny,
    },
  }),
  gradientOrange: {backgroundColor: '#FFAC3D', flex: 1},
  gradientRed: Styles.platformStyles({
    common: {
      backgroundColor: '#FF5D5D',
      borderTopLeftRadius: Styles.borderRadius,
      borderTopRightRadius: Styles.borderRadius,
      flex: 1,
    },
    isAndroid: {
      borderTopLeftRadius: Styles.globalMargins.tiny,
      borderTopRightRadius: Styles.globalMargins.tiny,
    },
  }),
  gradientYellow: {backgroundColor: '#FFF75A', flex: 1},
  newMeta: {
    alignSelf: 'center',
    marginRight: Styles.globalMargins.tiny,
  },
  wonderlandButton: Styles.platformStyles({
    common: {
      left: 0,
      margin: 2,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      position: 'absolute',
      top: 0,
      width: 112,
    },
    isIOS: {
      // marginBottom: 3,
      // marginTop: 3,
    },
  }),
  wonderlandButtonContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
      position: 'relative',
      width: 116,
    },
    isAndroid: {
      marginTop: 10,
    },
  }),
})

export {HeaderNewChatButton}
