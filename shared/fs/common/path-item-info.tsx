import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {formatTimeForFS} from '../../util/timestamp'

export type PathItemInfoProps = {
  lastModifiedTimestamp?: number
  lastWriter?: string
  mode: 'row' | 'default' | 'menu'
}

const Username = ({mode, lastWriter}) =>
  mode === 'row' && Styles.isMobile ? (
    <Kb.Text type="BodySmall">{lastWriter}</Kb.Text>
  ) : (
    <Kb.ConnectedUsernames
      type="BodySmallSecondaryLink"
      usernames={[lastWriter]}
      inline={true}
      onUsernameClicked="profile"
      underline={true}
    />
  )

const PathItemInfo = (props: PathItemInfoProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={props.mode !== 'row'}>
    <Kb.Text
      type={props.mode === 'menu' ? 'BodyTiny' : 'BodySmall'}
      style={props.mode === 'row' ? styles.textRow : styles.textDefault}
      lineClamp={props.mode === 'row' && Styles.isMobile ? 1 : undefined}
    >
      {!!props.lastModifiedTimestamp &&
        (props.mode === 'row' ? '' : 'Last modified ') +
          formatTimeForFS(props.lastModifiedTimestamp, props.mode !== 'row')}
      {!!props.lastWriter && (
        <>
          &nbsp;by&nbsp;
          <Username mode={props.mode} lastWriter={props.lastWriter} />
        </>
      )}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  textDefault: {
    textAlign: 'center',
  },
  textRow: Styles.platformStyles({
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
})

export default PathItemInfo
