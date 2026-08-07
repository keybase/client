import * as React from 'react'
import Text from '@/common-adapters/text'
import Button from '@/common-adapters/button'
import {Box2} from '@/common-adapters/box'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import type {MenuItems} from '@/common-adapters/floating-menu/menu-layout/index.shared'
import FloatingMenu from '@/common-adapters/floating-menu'
import * as Styles from '@/styles'

const Kb = {Box2, Button, FloatingMenu, Styles, Text}

type PopupProps = {
  attachTo?: React.RefObject<MeasureRef | null>
  onHidden: () => void
  onResolve: () => void
  text: string
  visible: boolean
}

const items: MenuItems = []

const UnknownMentionPopup = (props: PopupProps) => {
  const styles = useStyles()
  const {attachTo, onHidden, onResolve, text, visible} = props
  const header = (
    <Kb.Box2 direction="vertical" gap="tiny" padding="tiny" style={styles.popupContainer} gapStart={true}>
      <Kb.Text type="BodySemibold">User or team?</Kb.Text>
      <Kb.Text type="BodySmall">
        {text} could be either a user or team. You can find out with a quick request to Keybase.
      </Kb.Text>
      <Kb.Button label="Lookup" onClick={onResolve} />
    </Kb.Box2>
  )
  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      mode="bottomsheet"
      onHidden={onHidden}
      visible={visible}
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
  const styles = useStyles()
  const {onResolve: _onResolve, allowFontScaling, channel, name, style} = props
  const [showPopup, setShowPopup] = React.useState(false)
  const mentionRef = React.useRef<MeasureRef | null>(null)

  const handleMouseOver = () => setShowPopup(true)
  const handleMouseLeave = () => setShowPopup(false)

  const onResolve = () => {
    _onResolve()
    handleMouseLeave()
  }

  let text = `@${name}`
  if (channel.length > 0) {
    text += `#${channel}`
  }

  const content = (
    <Kb.Text
      textRef={mentionRef}
      type="BodySemibold"
      className={Kb.Styles.classNames({'hover-underline': !isMobile})}
      allowFontScaling={allowFontScaling}
      style={Kb.Styles.collapseStyles([style, styles.text])}
      onClick={handleMouseOver}
    >
      {text}
    </Kb.Text>
  )

  const popups = (
    <UnknownMentionPopup
      attachTo={mentionRef}
      onHidden={handleMouseLeave}
      onResolve={onResolve}
      text={text}
      visible={showPopup}
    />
  )

  return isMobile ? (
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

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
        },
      }),
      popupContainer: Kb.Styles.platformStyles({
        common: {
          textAlign: 'center',
        },
        isElectron: {
          width: 200,
        },
      }),
      text: Kb.Styles.platformStyles({
        common: {
          backgroundColor: theme.greyLight,
          borderRadius: 2,
          letterSpacing: 0.3,
          ...Kb.Styles.paddingH(2),
        },
        isElectron: {
          display: 'inline-block',
        },
      }),
    }) as const
)

export default UnknownMention
