import * as React from 'react'
import {Box, Box2} from './box'
import Text from './text'
import * as Styles from '../styles'

const Kb = {
  Box,
  Box2,
  Text,
}

export type Badge2Props = {
  badgeNumber?: number
  className?: string
  fontSize?: number
  height?: number
  leftRightPadding?: number
  containerStyle?: Styles.StylesCrossPlatform
  badgeStyle?: Styles.StylesCrossPlatform
  badgeNumberStyle?: Styles.StylesCrossPlatform
  border?: boolean
}

const Badge = React.memo(function Badge(p: Badge2Props) {
  const {border, containerStyle, className, badgeNumberStyle, badgeNumber, badgeStyle} = p
  const fontSize = p.fontSize ?? (Styles.isMobile ? 12 : 10)
  const height = p.height ?? (Styles.isMobile ? 20 : 16)
  const leftRightPadding = p.leftRightPadding ?? (Styles.isPhone ? 5 : 4)

  if (border) {
    const outerSize = height
    const innerSize = border ? height - 3 : height
    return (
      <Kb.Box2
        direction="vertical"
        pointerEvents="none"
        centerChildren={true}
        style={Styles.collapseStyles([
          styles.container,
          {
            borderRadius: outerSize,
            height: outerSize,
            minWidth: outerSize,
          },
          containerStyle,
        ])}
      >
        <Kb.Box2
          direction="vertical"
          className={className}
          style={Styles.collapseStyles([
            styles.badge,
            {
              borderRadius: innerSize,
              height: innerSize,
              minWidth: innerSize,
              paddingLeft: leftRightPadding,
              paddingRight: leftRightPadding,
            },
            badgeStyle,
          ])}
        >
          {!!badgeNumber && (
            <Kb.Text
              center={true}
              type="BodyTinyBold"
              style={Styles.collapseStyles([
                styles.text,
                {
                  fontSize: fontSize,
                  height: height,
                  lineHeight: Styles.isMobile ? height : `${height}px`, // likely unneeded
                },
                badgeNumberStyle,
              ] as any)}
            >
              {badgeNumber}
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  } else {
    return (
      <Kb.Box2
        direction="vertical"
        className={className}
        pointerEvents="none"
        style={Styles.collapseStyles([
          styles.badge,
          {
            borderRadius: height,
            height: height,
            minWidth: height,
            paddingLeft: leftRightPadding,
            paddingRight: leftRightPadding,
          },
          badgeStyle,
        ])}
      >
        {!!badgeNumber && (
          <Kb.Text
            center={true}
            type="BodyTinyBold"
            style={Styles.collapseStyles([
              styles.text,
              {
                fontSize: fontSize,
                height: height,
                lineHeight: Styles.isMobile ? height : `${height}px`,
              },
              badgeNumberStyle,
            ] as any)}
          >
            {badgeNumber}
          </Kb.Text>
        )}
      </Kb.Box2>
    )
  }
})
export default Badge

const styles = Styles.styleSheetCreate(() => ({
  badge: {
    ...Styles.globalStyles.flexBoxCenter,
    backgroundColor: Styles.globalColors.orange,
  },
  container: {backgroundColor: Styles.globalColors.white},
  text: {color: Styles.globalColors.white},
}))
