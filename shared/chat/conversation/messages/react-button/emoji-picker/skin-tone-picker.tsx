import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import * as Types from '../../../../../constants/types/chat2'

const skinTones: Array<undefined | Types.EmojiSkinTone> = [
  undefined,
  '1F3FB',
  '1F3FC',
  '1F3FD',
  '1F3FE',
  '1F3FF',
]
const skinToneToDotColor = (skinTone: undefined | Types.EmojiSkinTone): string => {
  switch (skinTone) {
    case undefined:
      return '#ffc93a'
    case '1F3FB':
      return '#fadcbc'
    case '1F3FC':
      return '#e1bb95'
    case '1F3FD':
      return '#bf9068'
    case '1F3FE':
      return '#9b643d'
    case '1F3FF':
      return '#5a4539'
  }
}

const circle = (skinTone: undefined | Types.EmojiSkinTone, isExpanded: boolean, outerCircle: boolean) => {
  return (
    <Kb.Box style={{position: 'relative'}}>
      {outerCircle && <Kb.Box style={styles.circleOuter} />}
      <Kb.Box
        style={Styles.collapseStyles([
          !isExpanded && styles.circleCollapsed,
          isExpanded && styles.circleExpanded,
          {backgroundColor: skinToneToDotColor(skinTone)},
        ])}
      ></Kb.Box>
    </Kb.Box>
  )
}

type Props = {
  currentSkinTone?: Types.EmojiSkinTone
  setSkinTone: (skinTone: undefined | Types.EmojiSkinTone) => void
}

const reorderedSkinTones = (props: Props): Array<undefined | Types.EmojiSkinTone> =>
  Styles.isMobile
    ? skinTones
    : [props.currentSkinTone, ...skinTones.filter(st => st !== props.currentSkinTone)]

const SkinTonePicker = (props: Props) => {
  const [expanded, setExpanded] = React.useState(false)
  const optionSkinTones = reorderedSkinTones(props).map((skinTone, index) => (
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
    marginLeft: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.xtiny,
    padding: Styles.globalMargins.xxtiny,
    position: 'absolute',
    zIndex: 1,
  },
  relative: {position: 'relative'},
}))
