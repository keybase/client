import * as React from 'react'
import * as Kb from '@/common-adapters'
import {FilteredTopLine} from './top-line'
import {BottomLine} from './inbox/row/small-team'
import {Avatars, TeamAvatar} from './avatars'
import type * as T from '@/constants/types'

type Props = {
  backgroundColor?: string
  isMuted: boolean
  isSelected: boolean
  onSelectConversation: () => void
  isLocked: boolean
  numSearchHits?: number
  maxSearchHits?: number
  participants: Array<string>
  showBadge: boolean
  showBold: boolean
  snippet?: string
  snippetDecoration: T.RPCChat.SnippetDecoration
  teamname: string
  usernameColor: string
}

const SelectableSmallTeam = (props: Props) => {
  const [isHovered, setIsHovered] = React.useState(false)
  const _onMouseLeave = React.useCallback(() => setIsHovered(false), [])
  const _onMouseOver = React.useCallback(() => setIsHovered(true), [])

  if (!props.teamname && props.participants.length === 0) {
    return (
      <Kb.ClickableBox onClick={props.onSelectConversation}>
        <Kb.Box2 direction="vertical" style={styles.container} centerChildren={true}>
          <Kb.ProgressIndicator style={styles.spinner} type="Small" />
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
  return (
    <Kb.ClickableBox onClick={props.onSelectConversation} style={styles.container}>
      <Kb.Box2
        alignItems="center"
        direction="horizontal"
        fullWidth={true}
        fullHeight={true}
        className={Kb.Styles.classNames('hover_background_color_blueGreyDark', {
          background_color_blue: props.isSelected,
        })}
        style={Kb.Styles.collapseStyles([
          styles.rowContainer,
          {
            backgroundColor: props.isSelected ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.white,
          },
        ])}
        onMouseLeave={_onMouseLeave}
        onMouseOver={_onMouseOver}
      >
        {props.teamname ? (
          <TeamAvatar
            teamname={props.teamname}
            isHovered={isHovered}
            isMuted={props.isMuted}
            isSelected={props.isSelected}
          />
        ) : (
          <Avatars
            backgroundColor={props.backgroundColor}
            isHovered={isHovered}
            isMuted={props.isMuted}
            isSelected={props.isSelected}
            isLocked={props.isLocked}
            participantOne={props.participants[0]}
            participantTwo={props.participants[1]}
          />
        )}
        <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne}>
          <FilteredTopLine
            isSelected={props.isSelected}
            numSearchHits={props.numSearchHits}
            maxSearchHits={props.maxSearchHits}
            participants={props.teamname ? [props.teamname] : props.participants}
            showBold={props.showBold}
            usernameColor={props.usernameColor}
          />
          {!props.numSearchHits && (
            <BottomLine
              snippet={props.snippet}
              snippetDecoration={props.snippetDecoration}
              isSelected={props.isSelected}
              allowBold={false}
            />
          )}
        </Kb.Box2>
        {props.showBadge && <Kb.Box2 direction="horizontal" style={styles.badge} />}
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const rowHeight = Kb.Styles.isMobile ? 64 : 56

const styles = Kb.Styles.styleSheetCreate(() => ({
  badge: {
    backgroundColor: Kb.Styles.globalColors.orange,
    borderRadius: 6,
    flexShrink: 0,
    height: Kb.Styles.globalMargins.tiny,
    width: Kb.Styles.globalMargins.tiny,
  },
  container: {
    flexShrink: 0,
    height: rowHeight,
  },
  rowContainer: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.clickable,
      paddingLeft: Kb.Styles.globalMargins.xsmall,
      paddingRight: Kb.Styles.globalMargins.xsmall,
    },
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
  }),
  spinner: {
    alignSelf: 'center',
  },
}))

export default SelectableSmallTeam
