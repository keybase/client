// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import features from '../../util/feature-flags'

type ErrProps = {
  dismiss: () => void,
  error: string,
  msg: string,
  onFeedback?: () => void,
  retry?: () => void,
  time: number,
}

const ErrToBanner = (props: ErrProps) => (
  <Kb.Banner
    onClose={props.dismiss}
    text={props.msg}
    color="red"
    actions={[
      ...(props.retry ? [{onClick: props.retry, title: 'Retry'}] : []),
      ...(props.onFeedback ? [{onClick: props.onFeedback, title: 'Let us know'}] : []),
    ]}
  />
)

const Err = features.admin
  ? (props: ErrProps) => (
      <Kb.WithTooltip
        containerStyle={{width: '100%'}}
        text={`${new Date(props.time).toString()}: ${props.error}`}
        multiline={true}
        position="bottom center"
      >
        <ErrToBanner {...props} />
      </Kb.WithTooltip>
    )
  : ErrToBanner

type ErrsProps = {
  errs: Array<ErrProps & {key: string}>,
}

const Errs = (props: ErrsProps) => (
  <Kb.Box2 fullWidth={true} direction="vertical">
    {props.errs.map(({key, ...errProps}, index) => (
      <React.Fragment key={key}>
        <Err {...errProps} />
        {props.errs.length > 1 && index !== props.errs.length && <Kb.Divider />}
      </React.Fragment>
    ))}
  </Kb.Box2>
)

export default Errs
