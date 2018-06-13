// @flow
import React, {PureComponent} from 'react'
import {Text, Markdown, Box, Meta} from '../../../../common-adapters'
import {
  globalStyles,
  globalColors,
  globalMargins,
  styleSheetCreate,
  collapseStyles,
  platformStyles,
} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  backgroundColor: ?string,
  participantNeedToRekey: boolean,
  showBold: boolean,
  snippet: ?string,
  snippetDecoration: ?string,
  subColor: string,
  youNeedToRekey: boolean,
  youAreReset: boolean,
  hasResetUsers: boolean,
  isSelected: boolean,
}

class BottomLine extends PureComponent<Props> {
  render() {
    let content

    if (this.props.youNeedToRekey) {
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
            style={platformStyles({
              common: {
                color: globalColors.white,
                fontSize: 12,
                lineHeight: 14,
              },
            })}
          >
            REKEY NEEDED
          </Text>
        </Box>
      )
    } else if (this.props.youAreReset) {
      content = (
        <Text
          type="BodySmallSemibold"
          backgroundMode="Terminal"
          style={platformStyles({
            common: {
              color: this.props.isSelected ? globalColors.white : globalColors.red,
              fontSize: isMobile ? 13 : 12,
              lineHeight: 14,
            },
          })}
        >
          Participants should let you back in.
        </Text>
      )
    } else if (this.props.participantNeedToRekey) {
      content = (
        <Text type="BodySmall" backgroundMode="Terminal" style={{color: this.props.subColor}}>
          Waiting for participants to rekey
        </Text>
      )
    } else if (this.props.snippet) {
      const baseStyle = styles.bottomLine

      let style

      if (this.props.subColor !== globalColors.black_40 || this.props.showBold) {
        style = collapseStyles([
          baseStyle,
          {
            color: this.props.subColor,
            ...(this.props.showBold ? globalStyles.fontBold : {}),
          },
        ])
      } else {
        style = baseStyle
      }

      content = (
        <Box>
          <Markdown preview={true} style={style}>
            {this.props.snippet}
          </Markdown>
          <Text type="BodySmall">
            {this.props.snippetDecoration}
          </Text>
        </Box>
      )
    } else {
      return null
    }

    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          backgroundColor: isMobile ? this.props.backgroundColor : undefined,
          flexGrow: 1,
          height: isMobile ? 20 : 17,
          maxHeight: isMobile ? 20 : 17,
        }}
      >
        {this.props.hasResetUsers && (
          <Meta title="reset" style={resetStyle} backgroundColor={globalColors.red} />
        )}
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'center',
            flexGrow: 1,
            height: '100%',
            position: 'relative',
          }}
        >
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              ...globalStyles.fillAbsolute,
              alignItems: 'center',
            }}
          >
            {content}
          </Box>
        </Box>
      </Box>
    )
  }
}

const resetStyle = platformStyles({
  common: {
    alignSelf: 'center',
    marginRight: 6,
  },
  isElectron: {},
  isMobile: {
    marginTop: 2,
  },
})

const styles = styleSheetCreate({
  bottomLine: platformStyles({
    isAndroid: {
      lineHeight: undefined,
    },
    isElectron: {
      color: globalColors.black_40,
      display: 'block',
      fontSize: 12,
      lineHeight: '15px',
      minHeight: 16,
      overflow: 'hidden',
      paddingRight: 30,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      width: '100%',
    },
    isMobile: {
      backgroundColor: globalColors.fastBlank,
      color: globalColors.black_40,
      fontSize: 13,
      paddingRight: 30,
    },
  }),
})

export {BottomLine}
