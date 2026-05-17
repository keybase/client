import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import {Portal} from './portal'
import {useTimeout} from './use-timers'
import {Box2} from './box'
import ClickableBox from './clickable-box'
import Toast from './toast'
import Text from './text'
import type {Props} from './with-tooltip.shared'
import type {MeasureRef} from './measure-ref'
import {View} from 'react-native'
import {useSafeAreaFrame} from 'react-native-safe-area-context'

const IGNORE_FOR_PROFILING = false as boolean

const Kb = {
  Box2,
  ClickableBox,
  Portal,
  Text,
  Toast,
}

type Dims = {
  height: number
  left: number
  top: number
  width: number
}

function WithTooltip(p: Props) {
  const {containerStyle, className, multiline, backgroundColor, toastStyle} = p
  const {disabled, toastClassName, children, position, textStyle, tooltip} = p

  // Desktop state
  const popupAnchor = React.useRef<MeasureRef | null>(null)
  const [desktopVisible, setDesktopVisible] = React.useState(false)

  // Native state
  const [left, setLeft] = React.useState(0)
  const [top, setTop] = React.useState(0)
  const [nativeVisible, setNativeVisible] = React.useState(false)
  const clickableRef = React.useRef<View>(null)
  const tooltipRef = React.useRef<View>(null)
  const setVisibleFalseLater = useTimeout(() => {
    setNativeVisible(false)
  }, 3000)
  const {width: screenWidth, height: screenHeight} = useSafeAreaFrame()

  C.Router2.useSafeFocusEffect(() => {
    return () => {
      setNativeVisible(false)
    }
  })

  if (!isMobile) {
    const onMouseEnter = () => setDesktopVisible(true)
    const onMouseLeave = () => setDesktopVisible(false)

    const toast = (
      <Kb.Toast
        containerStyle={Styles.collapseStyles([
          desktopStyles.container,
          multiline && desktopStyles.containerMultiline,
          backgroundColor && {backgroundColor},
          toastStyle,
        ])}
        visible={true}
        attachTo={popupAnchor}
        position={position || 'top center'}
        className={toastClassName}
      >
        <Kb.Text
          center={!isMobile}
          type="BodySmall"
          style={Styles.collapseStyles([desktopStyles.text, textStyle])}
        >
          {tooltip}
        </Kb.Text>
      </Kb.Toast>
    )

    return (
      <>
        <Kb.Box2
          direction="vertical"
          alignSelf="stretch"
          alignItems="center"
          justifyContent="center"
          style={containerStyle}
          ref={popupAnchor}
          onMouseOver={IGNORE_FOR_PROFILING ? undefined : onMouseEnter}
          onMouseLeave={IGNORE_FOR_PROFILING ? undefined : onMouseLeave}
          className={className}
        >
          {children}
        </Kb.Box2>
        {!disabled && desktopVisible && tooltip ? toast : null}
      </>
    )
  }

  const _onClick = () => {
    if (!clickableRef.current || !tooltipRef.current || nativeVisible) {
      return
    }

    Promise.all([
      new Promise<Dims>(resolve => {
        clickableRef.current?.measure(
          (_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
            resolve({height, left: pageX, top: pageY, width})
          }
        )
      }),
      new Promise<Dims>(resolve => {
        tooltipRef.current?.measure(
          (_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
            resolve({height, left: pageX, top: pageY, width})
          }
        )
      }),
    ] as const)
      .then(([c, t]) => {
        const constrainLeft = (ideal: number) => Math.max(0, Math.min(ideal, screenWidth - t.width))
        const constrainTop = (ideal: number) => Math.max(0, Math.min(ideal, screenHeight - t.height))
        if (position === 'bottom center') {
          setLeft(constrainLeft(c.left + c.width / 2 - t.width / 2))
          setTop(constrainTop(c.top + c.height))
        } else {
          setLeft(constrainLeft(c.left + c.width / 2 - t.width / 2))
          setTop(constrainTop(c.top - t.height))
        }

        setNativeVisible(true)
        setVisibleFalseLater()
      })
      .catch(() => {})
  }

  if (!p.showOnPressMobile || disabled) {
    return <View style={Styles.castStyleNative(containerStyle)}>{children}</View>
  }

  const animatedStyle = {opacity: nativeVisible ? 1 : 0}

  return (
    <>
      <View style={Styles.castStyleNative(containerStyle)} ref={clickableRef} collapsable={false}>
        <Kb.ClickableBox onClick={_onClick}>{children}</Kb.ClickableBox>
      </View>
      <Kb.Portal hostName="popup-root">
        <Kb.Box2
          direction="vertical"
          pointerEvents="box-none"
          style={Styles.collapseStyles([Styles.globalStyles.fillAbsolute, animatedStyle])}
        >
          <View pointerEvents="none" style={Styles.collapseStyles([Styles.globalStyles.flexBoxRow, {top}])}>
            <View
              style={Styles.collapseStyles([
                nativeStyles.container,
                {left},
                backgroundColor && {backgroundColor},
              ])}
              ref={tooltipRef}
              collapsable={false}
            >
              <Kb.Text
                center={!multiline}
                type="BodySmall"
                style={Styles.collapseStyles([nativeStyles.text, textStyle])}
                lineClamp={multiline ? undefined : 1}
              >
                {tooltip}
              </Kb.Text>
            </View>
          </View>
        </Kb.Box2>
      </Kb.Portal>
    </>
  )
}

export default WithTooltip

const desktopStyles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      borderRadius: Styles.borderRadius,
      pointerEvents: 'none',
    },
  }),
  containerMultiline: {
    maxWidth: 320,
    minWidth: 320,
    width: 320,
  },
  text: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.white,
      wordBreak: 'break-word',
    } as const,
  }),
}))

const nativeStyles = Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Styles.globalColors.black,
    borderRadius: Styles.borderRadius,
    maxWidth: 280,
    padding: Styles.globalMargins.xtiny,
  },
  text: {color: Styles.globalColors.white},
}))
