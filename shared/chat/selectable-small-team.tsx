import * as React from 'react'
import * as Kb from '@/common-adapters'
import {FilteredTopLine} from './top-line'
import {BottomLine} from './inbox/row/small-team'
import {Avatars, TeamAvatar} from './avatars'
import {useInboxRowSmall} from '@/stores/inbox-rows'
import type * as T from '@/constants/types'

type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  filter?: string
  name: string
  numSearchHits?: number
  maxSearchHits?: number
  participants?: Array<string>
  isSelected: boolean
  onSelectConversation: () => void
}

const getRowStyles = (isSelected: boolean, hasUnread: boolean) => {
  const backgroundColor = isSelected
    ? Kb.Styles.globalColors.blue
    : Kb.Styles.isPhone
      ? undefined
      : Kb.Styles.globalColors.blueGrey
  const showBold = !isSelected && hasUnread
  const usernameColor = isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black

  return {
    backgroundColor,
    showBold,
    usernameColor,
  }
}

const SelectableSmallTeam = (props: Props) => {
  const {conversationIDKey, isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} = props
  const row = useInboxRowSmall(conversationIDKey)
  const isMuted = row.isMuted
  const showBadge = row.hasBadge
  const rowStyles = getRowStyles(isSelected, row.hasUnread)
  const {backgroundColor, showBold, usernameColor} = rowStyles
  const isLocked = row.isLocked || row.participantNeedToRekey || row.youNeedToRekey
  const teamname = row.teamDisplayName
  const snippet = row.snippet
  const snippetDecoration = row.snippetDecoration

  // order participants by hit, if it's set
  const filter = props.filter ?? ''
  let participants =
    props.participants ?? (row.participants.length > 0 ? [...row.participants] : name.split(','))
  participants = participants.sort((a, b) => {
    const ai = a.indexOf(filter)
    const bi = b.indexOf(filter)

    if (ai === -1) {
      return bi === -1 ? -1 : 1
    } else if (bi === -1) {
      return -1
    } else {
      return bi === 0 ? 1 : -1
    }
  })

  const [isHovered, setIsHovered] = React.useState(false)
  const _onMouseLeave = () => setIsHovered(false)
  const _onMouseOver = () => setIsHovered(true)

  if (!teamname && participants.length === 0) {
    return (
      <Kb.ClickableBox direction="vertical" style={styles.container} centerChildren={true} onClick={onSelectConversation}>
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
        background_color_blue: isSelected,
      })}
      onClick={onSelectConversation}
      style={Kb.Styles.collapseStyles([
        styles.container,
        styles.rowContainer,
        {
          backgroundColor: isSelected ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.white,
        },
      ])}
      onMouseLeave={_onMouseLeave}
      onMouseOver={_onMouseOver}
    >
        {teamname ? (
          <TeamAvatar teamname={teamname} isHovered={isHovered} isMuted={isMuted} isSelected={isSelected} />
        ) : (
          <Avatars
            backgroundColor={backgroundColor}
            isHovered={isHovered}
            isMuted={isMuted}
            isSelected={isSelected}
            isLocked={isLocked}
            participantOne={participants[0]}
            participantTwo={participants[1]}
          />
        )}
        <Kb.Box2 direction="vertical" flex={1}>
          <FilteredTopLine
            isSelected={isSelected}
            numSearchHits={numSearchHits}
            maxSearchHits={maxSearchHits}
            participants={teamname ? [teamname] : participants}
            showBold={showBold}
            usernameColor={usernameColor}
          />
          {!numSearchHits && (
            <BottomLine
              conversationIDKey={conversationIDKey}
              snippet={snippet}
              snippetDecoration={snippetDecoration}
              isSelected={isSelected}
              allowBold={false}
            />
          )}
        </Kb.Box2>
        {showBadge && <Kb.Box2 direction="horizontal" style={styles.badge} />}
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
