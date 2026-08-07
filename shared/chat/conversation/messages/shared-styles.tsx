import * as Kb from '@/common-adapters'
// TODO remove
export const useSharedStyles = Kb.Styles.createStyleHook(theme => {
  const editing: Kb.Styles._StylesCrossPlatform = {
    borderRadius: 2,
    color: theme.blackOrBlack,
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingRight: Kb.Styles.globalMargins.tiny,
  }
  const sent: Kb.Styles._StylesCrossPlatform = Kb.Styles.platformStyles({
    isElectron: {
      // Make text selectable. On mobile we implement that differently.
      cursor: 'text',
      userSelect: 'text',
      whiteSpace: 'pre-wrap',
      width: '100%',
      wordBreak: 'break-word',
    } as const,
    isMobile: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
    },
  })
  const sentEditing: Kb.Styles._StylesCrossPlatform = {
    ...sent,
    ...editing,
  }
  const pendingFail = sent
  const pendingFailEditing: Kb.Styles._StylesCrossPlatform = {
    ...pendingFail,
    ...editing,
  }
  return {
    editing,
    highlighted: {
      color: theme.blackOrBlack,
    },
    pendingFail,
    pendingFailEditing,
    sent,
    sentEditing,
  } as const
})
