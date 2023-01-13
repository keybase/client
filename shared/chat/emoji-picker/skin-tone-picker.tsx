import * as React from 'react'
import * as Kb from './../../common-adapters'
import * as Styles from './../../styles'
import * as Types from './../../constants/types/chat2'
import {useSpring, animated} from 'react-spring'
import {skinTones} from './../../util/emoji'

const circle = (skinTone: undefined | Types.EmojiSkinTone, isExpanded: boolean, outerCircle: boolean) => {
  return (
    <Kb.Box style={{position: 'relative'}}>
      {outerCircle && <Kb.Box style={styles.circleOuter} />}
      <Kb.Box
        style={Styles.collapseStyles([
          !isExpanded && styles.circleCollapsed,
          isExpanded && styles.circleExpanded,
          {backgroundColor: Types.SkinToneToDotColor(skinTone)},
        ])}
      ></Kb.Box>
    </Kb.Box>
  )
}

type Props = {
  currentSkinTone?: Types.EmojiSkinTone
  onExpandChange?: (expanded: boolean) => void
  setSkinTone: (skinTone: undefined | Types.EmojiSkinTone) => void
}

const reorderedSkinTones = (currentSkinTone: Props['currentSkinTone']) => {
  if (Styles.isMobile || !currentSkinTone) return skinTones
  const idx = skinTones.indexOf(currentSkinTone)
  if (idx === -1) return skinTones
  const rest = [...skinTones]
  rest.splice(idx, 1)
  return [currentSkinTone, ...rest]
}

const AnimatedBox2 = animated(Kb.Box2)

const SkinTonePicker = (props: Props) => {
  const [expanded, _setExpanded] = React.useState(false)
  const setExpanded = (toSet: boolean) => {
    _setExpanded(toSet)
    props.onExpandChange?.(toSet)
  }
  const optionSkinTones = reorderedSkinTones(props.currentSkinTone).map((skinTone, index) => (
    <Kb.ClickableBox
      key={index.toString()}
      style={styles.dotContainerExpanded}
      onClick={() => {
        props.setSkinTone(skinTone)
        setExpanded(false)
      }}
    >
      {circle(skinTone, true, Styles.isMobile && skinTone === props.currentSkinTone)}
    </Kb.ClickableBox>
  ))

  const animStyle = useSpring({
    config: reactSprintConfig,
    from: {height: 26, ...styles.popupContainer},
    to: {height: 126},
  })

  return Styles.isMobile ? (
    expanded ? (
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        alignItems="center"
        style={styles.optionSkinTonesContainerMobile}
      >
        {optionSkinTones}
      </Kb.Box2>
    ) : (
      <Kb.ClickableBox onClick={() => setExpanded(true)}>
        <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny">
          {circle(props.currentSkinTone, false, false)}
          <Kb.Text type="BodySmallSemibold">Skin tone</Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  ) : (
    <Kb.Box style={styles.relative}>
      {expanded ? (
        <AnimatedBox2 direction="vertical" style={animStyle}>
          {optionSkinTones}
        </AnimatedBox2>
      ) : (
        <Kb.WithTooltip tooltip="Skin tone" containerStyle={styles.absolute}>
          <Kb.ClickableBox style={styles.dotContainerDesktop} onClick={() => setExpanded(true)}>
            {circle(props.currentSkinTone, false, false)}
          </Kb.ClickableBox>
        </Kb.WithTooltip>
      )}
      <Kb.Box style={styles.dotPlaceholder} />
    </Kb.Box>
  )
}

export default SkinTonePicker

const styles = Styles.styleSheetCreate(() => ({
  absolute: {position: 'absolute'},
  circleCollapsed: {
    borderRadius: Styles.globalMargins.small / 2,
    height: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
  circleExpanded: Styles.platformStyles({
    isElectron: {
      borderRadius: Styles.globalMargins.small / 2,
      height: Styles.globalMargins.small,
      width: Styles.globalMargins.small,
    },
    isMobile: {
      borderRadius: (Styles.globalMargins.small + Styles.globalMargins.xtiny) / 2,
      height: Styles.globalMargins.small + Styles.globalMargins.xtiny,
      width: Styles.globalMargins.small + Styles.globalMargins.xtiny,
    },
  }),
  circleOuter: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: (Styles.globalMargins.mediumLarge - Styles.globalMargins.xxtiny) / 2,
    borderStyle: 'solid',
    borderWidth: 1,
    height: Styles.globalMargins.mediumLarge - Styles.globalMargins.xxtiny,
    left: -5,
    position: 'absolute',
    top: -5,
    width: Styles.globalMargins.mediumLarge - Styles.globalMargins.xxtiny,
  },
  dotContainerDesktop: {
    padding: Styles.globalMargins.tiny,
  },
  dotContainerExpanded: {
    padding: Styles.globalMargins.xxtiny,
  },
  dotPlaceholder: {
    height: Styles.globalMargins.small * 2,
    width: Styles.globalMargins.small * 2,
  },
  optionSkinTonesContainerMobile: {
    justifyContent: 'space-between',
  },
  popupContainer: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.globalMargins.small,
    borderStyle: 'solid',
    borderWidth: 1,
    marginLeft: Styles.globalMargins.xtiny - 1,
    marginTop: Styles.globalMargins.xtiny - 1,
    overflow: 'hidden',
    padding: Styles.globalMargins.xxtiny,
    position: 'absolute',
    zIndex: 1,
  },
  relative: {position: 'relative'},
}))

const reactSprintConfig = {clamp: true, friction: 20, tension: 210}
