import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {useFSState} from '@/stores/fs'

const ErrsContainer = () => {
  const {_errors, _dismiss} = useFSState(
    C.useShallow(s => ({
      _dismiss: s.dispatch.dismissRedbar,
      _errors: s.errors,
    }))
  )
  const props = {
    errs: _errors.map((err, i) => ({
      dismiss: () => _dismiss(i),
      msg: err,
    })),
  }
  return (
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
}

const Err = (props: {dismiss: () => void; msg: string}) => (
  <Kb.Banner onClose={props.dismiss} color="red">
    <Kb.BannerParagraph bannerColor="red" content={props.msg} />
  </Kb.Banner>
)

export default ErrsContainer
