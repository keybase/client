import React from 'react'
import Text from '../../../common-adapters/text'
import Button from '../../../common-adapters/button'
import {Box2} from '../../../common-adapters/box'
import FloatingMenu from '../../../common-adapters/floating-menu'
import * as Styles from '../../../styles'

const Kb = {Box2, Button, FloatingMenu, Text}

type PopupProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  onResolve: () => void
  text: string
  visible: boolean
}

const items = []

const UnknownMentionPopup = (props: PopupProps) => {
  const header = {
    title: 'header',
    view: (
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.popupContainer} gapStart={true}>
        <Kb.Text type="BodySemibold">User or Team</Kb.Text>
        <Kb.Text type="BodySmall">
          {props.text} could be either a user or team. You can find out with a quick request to Keybase.
        </Kb.Text>
        <Kb.Button label="Lookup" onClick={props.onResolve} />
      </Kb.Box2>
    ),
  }
  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      onHidden={props.onHidden}
      visible={props.visible}
    />
  )
}

type Props = {
  allowFontScaling?: boolean
  channel: string
  name: string
  onResolve: () => void
  style?: Styles.StylesCrossPlatform
}

type State = {
  showPopup: boolean
}

class UnknownMention extends React.Component<Props, State> {
  _mentionRef = React.createRef<Text>()
  state = {showPopup: false}
  _getAttachmentRef = () => {
    return this._mentionRef.current
  }
  _onMouseOver = () => {
    this.setState({showPopup: true})
  }
  _onMouseLeave = () => {
    this.setState({showPopup: false})
  }
  render() {
    let text = `@${this.props.name}`
    if (this.props.channel.length > 0) {
      text += `#${this.props.channel}`
    }
    const content = (
      <Kb.Text
        ref={this._mentionRef}
        type="Body"
        className={Styles.classNames({'hover-underline': !Styles.isMobile})}
        allowFontScaling={this.props.allowFontScaling}
        style={Styles.collapseStyles([this.props.style, styles.text])}
        onClick={this._onMouseOver}
      >
        {Styles.isMobile && ' '}
        {text}
        {Styles.isMobile && ' '}
      </Kb.Text>
    )
    const popups = (
      <UnknownMentionPopup
        attachTo={this._getAttachmentRef}
        onHidden={this._onMouseLeave}
        onResolve={this.props.onResolve}
        text={text}
        visible={this.state.showPopup}
      />
    )
    return Styles.isMobile ? (
      <>
        {content}
        {popups}
      </>
    ) : (
      <Kb.Box2
        direction="horizontal"
        style={styles.container}
        onMouseOver={this._onMouseOver}
        onMouseLeave={this._onMouseLeave}
      >
        {content}
        {popups}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      display: 'inline-block',
    },
  }),
  popupContainer: Styles.platformStyles({
    common: {
      padding: Styles.globalMargins.tiny,
      textAlign: 'center',
    },
    isElectron: {
      width: 200,
    },
  }),
  text: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.greyLight,
      borderRadius: 2,
      letterSpacing: 0.3,
      paddingLeft: 2,
      paddingRight: 2,
    },
    isElectron: {
      display: 'inline-block',
    },
  }),
  warning: {
    color: Styles.globalColors.redDark,
  },
})

export default UnknownMention
