import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type KnowPasswordProps = {}
const KnowPassword = (props: KnowPasswordProps) => <Kb.Text type="HeaderBig">Know your password?</Kb.Text>

type EnterPasswordProps = {}
const EnterPassword = (props: EnterPasswordProps) => <Kb.Text type="HeaderBig">Enter your password?</Kb.Text>

export {EnterPassword, KnowPassword}
