import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Common from './common'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

export const transformer = (
  input: {
    fullName: string
    username: string
    teamname?: string
    channelname?: string
  },
  marker: string,
  tData: Common.TransformerData,
  preview: boolean
) => {
  let s: string
  if (input.teamname) {
    if (input.channelname) {
      s = input.teamname + '#' + input.channelname
    } else {
      s = input.teamname
    }
  } else {
    s = input.username
  }
  return Common.standardTransformer(`${marker}${s}`, tData, preview)
}

export const keyExtractor = ({
  username,
  teamname,
  channelname,
}: {
  username: string
  teamname?: string
  channelname?: string
}) => {
  if (teamname) {
    if (channelname) {
      return teamname + '#' + channelname
    } else {
      return teamname
    }
  } else {
    return username
  }
}

export const Renderer = (p: any) => {
  const selected: boolean = p.selected
  const username: string = p.value.username
  const fullName: string = p.value.fullName
  const teamname: string | undefined = p.value.teamname
  const channelname: string | undefined = p.value.channelname

  return teamname ? (
    <Common.TeamSuggestion teamname={teamname} channelname={channelname} selected={selected} />
  ) : (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([
        Common.styles.suggestionBase,
        Common.styles.fixSuggestionHeight,
        {backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white},
      ])}
      gap="tiny"
    >
      {Constants.isSpecialMention(username) ? (
        <Kb.Box2 direction="horizontal" style={styles.iconPeople}>
          <Kb.Icon type="iconfont-people" color={Styles.globalColors.blueDark} fontSize={16} />
        </Kb.Box2>
      ) : (
        <Kb.Avatar username={username} size={32} />
      )}
      <Kb.ConnectedUsernames
        type="BodyBold"
        colorFollowing={true}
        usernames={username}
        withProfileCardPopup={false}
      />
      <Kb.Text type="BodySmall">{fullName}</Kb.Text>
    </Kb.Box2>
  )
}

export const styles = Styles.styleSheetCreate(() => ({
  iconPeople: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: 16,
    borderStyle: 'solid',
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
}))
