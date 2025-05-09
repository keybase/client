import * as React from 'react'
import Text from '@/common-adapters/text'
import Button from '@/common-adapters/button'
import {Box2} from '@/common-adapters/box'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import type {MenuItems} from '@/common-adapters/floating-menu/menu-layout'
import FloatingMenu from '@/common-adapters/floating-menu'
import * as Styles from '@/styles'

const Kb = {Box2, Button, FloatingMenu, Styles, Text}

type PopupProps = {
  attachTo?: React.RefObject<MeasureRef>
  onHidden: () => void
  onResolve: () => void
  text: string
  visible: boolean
}

const items: MenuItems = []

const UnknownMentionPopup = (props: PopupProps) => {
  const header = (
    <Kb.Box2 direction="vertical" gap="tiny" style={styles.popupContainer} gapStart={true}>
      <Kb.Text type="BodySemibold">User or team?</Kb.Text>
      <Kb.Text type="BodySmall">
        {props.text} could be either a user or team. You can find out with a quick request to Keybase.
      </Kb.Text>
      <Kb.Button label="Lookup" onClick={props.onResolve} />
    </Kb.Box2>
  )
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

const UnknownMention = (props: Props) => {
  const [showPopup, setShowPopup] = React.useState(false)
  const mentionRef = React.useRef<MeasureRef>(null)

  const handleMouseOver = () => setShowPopup(true)
  const handleMouseLeave = () => setShowPopup(false)

  let text = `@${props.name}`
  if (props.channel.length > 0) {
    text += `#${props.channel}`
  }

  const content = (
    <Kb.Text
      textRef={mentionRef}
      type="BodySemibold"
      className={Kb.Styles.classNames({'hover-underline': !Styles.isMobile})}
      allowFontScaling={props.allowFontScaling}
      style={Kb.Styles.collapseStyles([props.style, styles.text])}
      onClick={handleMouseOver}
    >
      {text}
    </Kb.Text>
  )

  const popups = (
    <UnknownMentionPopup
      attachTo={mentionRef}
      onHidden={handleMouseLeave}
      onResolve={props.onResolve}
      text={text}
      visible={showPopup}
    />
  )

  return Kb.Styles.isMobile ? (
    <>
      {content}
      {popups}
    </>
  ) : (
    <Kb.Box2
      direction="horizontal"
      style={styles.container}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
    >
      {content}
      {popups}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
        },
      }),
      popupContainer: Kb.Styles.platformStyles({
        common: {
          padding: Kb.Styles.globalMargins.tiny,
          textAlign: 'center',
        },
        isElectron: {
          width: 200,
        },
      }),
      text: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.greyLight,
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
        color: Kb.Styles.globalColors.redDark,
      },
    }) as const
)

export default UnknownMention
