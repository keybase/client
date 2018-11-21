// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {resetChatWithoutThem} from '../../actions/chat2-gen'

export type Props = {
  whitelist: Array<string>,
  onSave: () => void,
  onWhitelistRemove: string => void,
}

class Chat extends React.PureComponent<Props> {
  render() {
    return (
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodyBig">Post Link Previews?</Kb.Text>
          <Kb.Text type="Body">
            Your Keybase app will visit the links you share and automatically post previews.
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
          <Kb.RadioButton label="Always" />
          <Kb.RadioButton label="Yes, but only for these sites:" />
          <Kb.Box2 direction="vertical" style={styles.whitelist}>
            {this.props.whitelist.map(w => {
              return (
                <Kb.Box2 direction="vertical" fullWidth={true}>
                  <Kb.Box2 direction="horizontal" fullWidth={true}>
                    <Kb.Text type="BodySemibold">{w}</Kb.Text>
                    <Kb.Text
                      type="BodyPrimaryLink"
                      onClick={this.props.onWhitelistRemove}
                      style={styles.whitelistRemove}
                    >
                      Remove
                    </Kb.Text>
                  </Kb.Box2>
                  <Kb.Divider
                    style={Styles.collapseStyles([{marginTop: 4, marginBottom: 4}, styles.divider])}
                    fullWidth={true}
                  />
                </Kb.Box2>
              )
            })}
          </Kb.Box2>
          <Kb.RadioButton label="Never" />
        </Kb.Box2>
        <Kb.Divider style={styles.divider} />
        <Kb.Button onClick={this.props.onSave} label="Save" type="Primary" style={styles.save} />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      marginLeft: 28,
    },
  }),
  divider: {
    height: 2,
  },
  save: Styles.platformStyles({
    isElectron: {
      marginTop: 8,
      alignSelf: 'flex-start',
    },
  }),
  whitelist: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: Styles.globalColors.lightGrey,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      height: 95,
      minWidth: 305,
      paddingTop: 3,
      paddingLeft: 9,
      paddingBottom: 3,
      paddingRight: 8,
      marginLeft: 26,
      overflow: 'auto',
    },
  }),
  whitelistRemove: Styles.platformStyles({
    isElectron: {
      marginLeft: 'auto',
    },
  }),
})

export default Chat
