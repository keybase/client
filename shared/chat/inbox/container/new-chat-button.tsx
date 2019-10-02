import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {namedConnect} from '../../../util/container'
import {appendNewChatBuilder} from '../../../actions/typed-routes'

type OwnProps = {
  hide: boolean
  onNewChat: () => void
}

const _HeaderNewChatButton = (props: OwnProps) => {
  if (props.hide) {
    return null
  }
  return (
    <Kb.Box style={styles.rainbowButtonContainer}>
      <Kb.Box2 direction="vertical" style={styles.gradientContainer}>
        <Kb.Box style={styles.gradientRed} />
        <Kb.Box style={styles.gradientOrange} />
        <Kb.Box style={styles.gradientYellow} />
        <Kb.Box style={styles.gradientGreen} />
      </Kb.Box2>
      <Kb.Button
        label={'New chat'}
        mode="Primary"
        onClick={props.onNewChat}
        small={true}
        style={styles.rainbowButton}
        type="Default"
      />
    </Kb.Box>
  )
}

const HeaderNewChatButton = namedConnect(
  state => ({
    hide:
      state.chat2.inboxHasLoaded &&
      !!state.chat2.inboxLayout &&
      (state.chat2.inboxLayout.smallTeams || []).length === 0 &&
      (state.chat2.inboxLayout.bigTeams || []).length === 0,
  }),
  dispatch => ({
    onNewChat: () => dispatch(appendNewChatBuilder()),
  }),
  (stateProps, dispatchProps) => ({...stateProps, ...dispatchProps}),
  'HeaderNewChatButton'
)(_HeaderNewChatButton)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
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
      rainbowButton: Styles.platformStyles({
        common: {
          left: 0,
          margin: 2,
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
          position: 'absolute',
          top: 0,
          width: 96,
        },
      }),
      rainbowButtonContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          marginLeft: Styles.globalMargins.small,
          marginRight: Styles.globalMargins.small,
          position: 'relative',
          width: 100,
        },
        isAndroid: {
          marginTop: 10,
        },
      }),
    } as const)
)

export {HeaderNewChatButton}
