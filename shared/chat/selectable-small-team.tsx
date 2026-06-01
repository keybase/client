import * as React from 'react'
import * as Kb from '@/common-adapters'
import {FilteredTopLine} from './top-line'
import {BottomLine} from './inbox/row/small-team'
import {Avatars, TeamAvatar} from './avatars'
import type * as T from '@/constants/types'

type Props = {
  backgroundColor?: string
  conversationIDKey: T.Chat.ConversationIDKey
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
  const _onMouseLeave = () => setIsHovered(false)
  const _onMouseOver = () => setIsHovered(true)

  if (!props.teamname && props.participants.length === 0) {
    return (
      <Kb.ClickableBox direction="vertical" style={styles.container} centerChildren={true} onClick={props.onSelectConversation}>
        <Kb.ProgressIndicator style={styles.spinner} type="Small" />
      </Kb.ClickableBox>
    )
  }
  return (
    <Kb.ClickableBox
      direction="horizontal"
      alignItems="center"
      fullWidth={true}
      fullHeight={true}
      className={Kb.Styles.classNames('hover_background_color_blueGreyDark', {
        background_color_blue: props.isSelected,
      })}
      onClick={props.onSelectConversation}
      style={Kb.Styles.collapseStyles([
        styles.container,
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
        <Kb.Box2 direction="vertical" flex={1}>
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
              conversationIDKey={props.conversationIDKey}
              snippet={props.snippet}
              snippetDecoration={props.snippetDecoration}
              isSelected={props.isSelected}
              allowBold={false}
            />
          )}
        </Kb.Box2>
        {props.showBadge && <Kb.Box2 direction="horizontal" style={styles.badge} />}
    </Kb.ClickableBox>
  )
}

const rowHeight = isMobile ? 64 : 56

const styles = Kb.Styles.styleSheetCreate(() => ({
  badge: {
    backgroundColor: Kb.Styles.globalColors.orange,
    borderRadius: 6,
    flexShrink: 0,
    ...Kb.Styles.size(Kb.Styles.globalMargins.tiny),
  },
  container: {
    flexShrink: 0,
    height: rowHeight,
  },
  rowContainer: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.xsmall),
    },
    isMobile: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
    },
  }),
  spinner: {
    alignSelf: 'center',
  },
}))

export default SelectableSmallTeam
