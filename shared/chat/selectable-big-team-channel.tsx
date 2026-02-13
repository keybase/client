import * as React from 'react'
import * as Kb from '@/common-adapters'
import {TeamAvatar} from './avatars'
import {pluralize} from '@/util/string'
import {BottomLine} from './inbox/row/small-team'
import type * as T from '@/constants/types'

type Props = {
  isSelected: boolean
  numSearchHits?: number
  maxSearchHits?: number
  teamname: string
  channelname: string
  onSelectConversation: () => void
  showBadge: boolean
  showBold: boolean
  snippet?: string
  snippetDecoration: T.RPCChat.SnippetDecoration
}

const SelectableBigTeamChannel = (props: Props) => {
  const [isHovered, setIsHovered] = React.useState(false)

  const _onMouseLeave = React.useCallback(() => setIsHovered(false), [])
  const _onMouseOver = React.useCallback(() => setIsHovered(true), [])
  const _getSearchHits = () => {
    if (!props.numSearchHits) {
      return ''
    }
    if (props.maxSearchHits) {
      return props.numSearchHits >= props.maxSearchHits ? `${props.numSearchHits}+` : `${props.numSearchHits}`
    }
    return `${props.numSearchHits}`
  }

  const boldOverride = props.showBold ? Kb.Styles.globalStyles.fontBold : null
  const rowLoadedContent = (
    <>
      <TeamAvatar teamname={props.teamname} isMuted={false} isSelected={false} isHovered={isHovered} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.textContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.Text
            type="BodySemibold"
            style={Kb.Styles.collapseStyles([
              styles.teamname,
              {color: props.isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black},
            ])}
            title={props.teamname}
            lineClamp={Kb.Styles.isMobile ? 1 : undefined}
            ellipsizeMode="tail"
          >
            {props.teamname}
          </Kb.Text>
          <Kb.Text
            type="BodySemibold"
            style={Kb.Styles.collapseStyles([
              boldOverride,
              styles.channelname,
              {color: props.isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black},
            ])}
            title={`#${props.channelname}`}
            lineClamp={Kb.Styles.isMobile ? 1 : undefined}
            ellipsizeMode="tail"
          >
            &nbsp;#
            {props.channelname}
          </Kb.Text>
        </Kb.Box2>
        {!props.numSearchHits && (
          <BottomLine
            snippet={props.snippet}
            snippetDecoration={props.snippetDecoration}
            isSelected={props.isSelected}
            allowBold={false}
          />
        )}
        {!!props.numSearchHits && (
          <Kb.Text
            type="BodySmall"
            style={Kb.Styles.collapseStyles([props.isSelected && styles.selectedText])}
          >
            {_getSearchHits()} {pluralize('result', props.numSearchHits)}
          </Kb.Text>
        )}
      </Kb.Box2>
      {props.showBadge && <Kb.Box2 direction="horizontal" style={styles.badge} />}
    </>
  )
  return (
    <Kb.ClickableBox onClick={props.onSelectConversation}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        centerChildren={true}
        className="hover_background_color_blueGreyDark"
        style={Kb.Styles.collapseStyles([
          styles.filteredRow,
          {
            backgroundColor: props.isSelected ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.white,
          },
        ])}
        onMouseLeave={_onMouseLeave}
        onMouseOver={_onMouseOver}
      >
        {props.teamname ? rowLoadedContent : <Kb.ProgressIndicator type="Small" />}
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const rowHeight = Kb.Styles.isMobile ? 64 : 56

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        backgroundColor: Kb.Styles.globalColors.orange,
        borderRadius: 6,
        flexShrink: 0,
        height: Kb.Styles.globalMargins.tiny,
        width: Kb.Styles.globalMargins.tiny,
      },
      channelname: Kb.Styles.platformStyles({
        // TODO: tweak this so that they take up full space in popup
        common: {
          flexShrink: 0,
          maxWidth: '70%',
        },
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      filteredRow: Kb.Styles.platformStyles({
        common: {
          height: rowHeight,
        },
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
        },
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      selectedText: {
        color: Kb.Styles.globalColors.white,
      },
      teamname: Kb.Styles.platformStyles({
        common: {
          color: Kb.Styles.globalColors.black,
          flexShrink: 1,
        },
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      textContainer: {
        flexShrink: 1,
        overflow: 'hidden',
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default SelectableBigTeamChannel
