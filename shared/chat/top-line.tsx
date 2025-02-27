import * as React from 'react'
import * as Kb from '@/common-adapters'
import {pluralize} from '@/util/string'

type Props = {
  isSelected: boolean
  numSearchHits?: number
  maxSearchHits?: number
  participants: Array<string>
  showBold: boolean
  usernameColor?: string
}

const FilteredTopLine = (props: Props) => {
  const _getSearchHits = () => {
    if (!props.numSearchHits) {
      return ''
    }
    if (props.maxSearchHits) {
      return props.numSearchHits >= props.maxSearchHits ? `${props.numSearchHits}+` : `${props.numSearchHits}`
    }
    return `${props.numSearchHits}`
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text
        type="BodySemibold"
        lineClamp={1}
        style={Kb.Styles.collapseStyles([
          props.showBold && styles.boldOverride,
          styles.usernames,
          {color: props.usernameColor} as any,
        ])}
      >
        {props.participants.join(', ')}
      </Kb.Text>
      {!!props.numSearchHits && (
        <Kb.Text type="BodySmall" style={Kb.Styles.collapseStyles([props.isSelected && styles.selectedText])}>
          {_getSearchHits()} {pluralize('result', props.numSearchHits)}
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  boldOverride: {
    ...Kb.Styles.globalStyles.fontBold,
  },
  selectedText: {
    color: Kb.Styles.globalColors.white,
  },
  usernames: {
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
}))

export {FilteredTopLine}
