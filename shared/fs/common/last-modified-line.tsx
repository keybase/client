import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {formatTimeForFS} from '../../util/timestamp'

export type LastModifiedLineProps = {
  lastModifiedTimestamp?: number
  lastWriter?: string
  mode: 'row' | 'default' | 'menu'
}

const Username = ({mode, lastWriter}) =>
  mode === 'row' && Styles.isMobile ? (
    <Kb.Text type="BodySmall">{lastWriter}</Kb.Text>
  ) : (
    <Kb.ConnectedUsernames
      type="BodyTinyLink"
      usernames={[lastWriter]}
      inline={true}
      onUsernameClicked="profile"
      underline={true}
    />
  )

const LastModifiedLine = (props: LastModifiedLineProps) => {
  const time =
    !!props.lastModifiedTimestamp &&
    (props.mode === 'row' ? '' : 'Last modified ') +
      formatTimeForFS(props.lastModifiedTimestamp, props.mode !== 'row')
  const by = !!props.lastWriter && (
    <>
      &nbsp;by&nbsp;
      <Username mode={props.mode} lastWriter={props.lastWriter} />
    </>
  )
  const getText = (children: React.ReactNode) => (
    <Kb.Text
      type={props.mode === 'menu' ? 'BodyTiny' : 'BodySmall'}
      style={props.mode === 'row' ? styles.textRow : styles.textDefault}
      lineClamp={props.mode === 'row' && Styles.isMobile ? 1 : undefined}
    >
      {children}
    </Kb.Text>
  )
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={props.mode !== 'row'}>
      {props.mode === 'menu' ? [getText(time), getText(by)] : getText([time, by])}
    </Kb.Box2>
  )
}

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

export default LastModifiedLine
