import * as React from 'react'
import * as Kb from './../../common-adapters'
import * as T from './../../constants/types'
import {skinTones} from './../../util/emoji'

const circle = (skinTone: undefined | T.Chat.EmojiSkinTone, isExpanded: boolean, outerCircle: boolean) => {
  return (
    <Kb.Box style={{position: 'relative'}}>
      {outerCircle && <Kb.Box style={styles.circleOuter} />}
      <Kb.Box
        style={Kb.Styles.collapseStyles([
          !isExpanded && styles.circleCollapsed,
          isExpanded && styles.circleExpanded,
          {backgroundColor: T.Chat.SkinToneToDotColor(skinTone)},
        ])}
      ></Kb.Box>
    </Kb.Box>
  )
}

type Props = {
  currentSkinTone?: T.Chat.EmojiSkinTone
  onExpandChange?: (expanded: boolean) => void
  setSkinTone: (skinTone: undefined | T.Chat.EmojiSkinTone) => void
}

const reorderedSkinTones = (currentSkinTone: Props['currentSkinTone']) => {
  if (Kb.Styles.isMobile || !currentSkinTone) return skinTones
  const idx = skinTones.indexOf(currentSkinTone)
  if (idx === -1) return skinTones
  const rest = [...skinTones]
  rest.splice(idx, 1)
  return [currentSkinTone, ...rest]
}

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
      {circle(skinTone, true, Kb.Styles.isMobile && skinTone === props.currentSkinTone)}
    </Kb.ClickableBox>
  ))

  return Kb.Styles.isMobile ? (
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
        <Kb.Box2 direction="vertical" style={styles.popupContainer}>
          {optionSkinTones}
        </Kb.Box2>
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  absolute: {position: 'absolute'},
  circleCollapsed: {
    borderRadius: Kb.Styles.globalMargins.small / 2,
    height: Kb.Styles.globalMargins.small,
    width: Kb.Styles.globalMargins.small,
  },
  circleExpanded: Kb.Styles.platformStyles({
    isElectron: {
      borderRadius: Kb.Styles.globalMargins.small / 2,
      height: Kb.Styles.globalMargins.small,
      width: Kb.Styles.globalMargins.small,
    },
    isMobile: {
      borderRadius: (Kb.Styles.globalMargins.small + Kb.Styles.globalMargins.xtiny) / 2,
      height: Kb.Styles.globalMargins.small + Kb.Styles.globalMargins.xtiny,
      width: Kb.Styles.globalMargins.small + Kb.Styles.globalMargins.xtiny,
    },
  }),
  circleOuter: {
    backgroundColor: Kb.Styles.globalColors.white,
    borderColor: Kb.Styles.globalColors.black_10,
    borderRadius: (Kb.Styles.globalMargins.mediumLarge - Kb.Styles.globalMargins.xxtiny) / 2,
    borderStyle: 'solid',
    borderWidth: 1,
    height: Kb.Styles.globalMargins.mediumLarge - Kb.Styles.globalMargins.xxtiny,
    left: -5,
    position: 'absolute',
    top: -5,
    width: Kb.Styles.globalMargins.mediumLarge - Kb.Styles.globalMargins.xxtiny,
  },
  dotContainerDesktop: {
    padding: Kb.Styles.globalMargins.tiny,
  },
  dotContainerExpanded: {
    padding: Kb.Styles.globalMargins.xxtiny,
  },
  dotPlaceholder: {
    height: Kb.Styles.globalMargins.small * 2,
    width: Kb.Styles.globalMargins.small * 2,
  },
  optionSkinTonesContainerMobile: {
    justifyContent: 'space-between',
  },
  popupContainer: {
    backgroundColor: Kb.Styles.globalColors.white,
    borderColor: Kb.Styles.globalColors.black_10,
    borderRadius: Kb.Styles.globalMargins.small,
    borderStyle: 'solid',
    borderWidth: 1,
    height: 126,
    marginLeft: Kb.Styles.globalMargins.xtiny - 1,
    marginTop: Kb.Styles.globalMargins.xtiny - 1,
    overflow: 'hidden',
    padding: Kb.Styles.globalMargins.xxtiny,
    position: 'absolute',
    zIndex: 1,
  },
  relative: {position: 'relative'},
}))
