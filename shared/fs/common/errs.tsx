import * as React from 'react'
import * as Kb from '../../common-adapters'

export type ErrProps = {
  dismiss: () => void
  msg: string
}

const Err = (props: ErrProps) => (
  <Kb.Banner onClose={props.dismiss} color="red">
    <Kb.BannerParagraph bannerColor="red" content={props.msg} />
  </Kb.Banner>
)

type ErrsProps = {
  errs: Array<ErrProps>
}

const Errs = (props: ErrsProps) => (
  <>
    <Kb.Box2 fullWidth={true} direction="vertical">
      {props.errs.map((errProps, index) => (
        <React.Fragment key={index}>
          <Err {...errProps} />
          {props.errs.length > 1 && index !== props.errs.length && <Kb.Divider />}
        </React.Fragment>
      ))}
    </Kb.Box2>
    {!!props.errs.length && <Kb.Divider />}
  </>
)

export default Errs
