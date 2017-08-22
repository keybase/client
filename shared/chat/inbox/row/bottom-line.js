// @flow
import React, {PureComponent} from 'react'
import {Text, Markdown, Box} from '../../../common-adapters'
import {
  globalStyles,
  globalColors,
  globalMargins,
  styleSheetCreate,
  collapseStyles,
  lineHeight,
} from '../../../styles'
import {isMobile} from '../../../constants/platform'

type BottomLineProps = {
  backgroundColor: ?string,
  participantNeedToRekey: boolean,
  showBold: boolean,
  snippet: ?string,
  subColor: ?string,
  youNeedToRekey: boolean,
}

class BottomLine extends PureComponent<BottomLineProps> {
  render() {
    const {participantNeedToRekey, youNeedToRekey, showBold, subColor, snippet, backgroundColor} = this.props
    let content

    if (youNeedToRekey) {
      content = (
        <Box
          style={{
            alignSelf: 'center',
            backgroundColor: globalColors.red,
            borderRadius: 2,
            paddingLeft: globalMargins.xtiny,
            paddingRight: globalMargins.xtiny,
          }}
        >
          <Text
            type="BodySmallSemibold"
            backgroundMode="Terminal"
            style={{
              color: globalColors.white,
              fontSize: 11,
              lineHeight: 14,
            }}
          >
            REKEY NEEDED
          </Text>
        </Box>
      )
    } else if (participantNeedToRekey) {
      content = (
        <Text type="BodySmall" backgroundMode="Terminal" style={{color: subColor}}>
          Waiting for participants to rekey
        </Text>
      )
    } else if (snippet) {
      const baseStyle = styles['bottomLine']

      let style

      if (subColor !== globalColors.black_40 || showBold) {
        style = collapseStyles([
          baseStyle,
          {
            color: subColor,
            ...(showBold ? globalStyles.fontBold : {}),
          },
        ])
      } else {
        style = baseStyle
      }

      content = (
        <Markdown preview={true} style={style}>
          {snippet}
        </Markdown>
      )
    } else {
      return null
    }

    const height = isMobile ? 16 : 17
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          backgroundColor: isMobile ? backgroundColor : undefined,
          flexGrow: 1,
          maxHeight: height,
          minHeight: height,
          position: 'relative',
        }}
      >
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'flex-start',
            bottom: 0,
            justifyContent: 'flex-start',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        >
          {content}
        </Box>
      </Box>
    )
  }
}

const noWrapStyle = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
}

const styles = styleSheetCreate({
  bottomLine: isMobile
    ? {
        color: globalColors.black_40,
        fontSize: 13,
        lineHeight: lineHeight(17),
        marginTop: 2,
        paddingRight: 30,
      }
    : {
        ...noWrapStyle,
        color: globalColors.black_40,
        fontSize: 11,
        lineHeight: lineHeight(15),
        minHeight: 15,
        paddingRight: 30,
      },
})

export default BottomLine
