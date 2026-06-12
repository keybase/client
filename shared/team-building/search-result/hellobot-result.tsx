import type {ResultProps} from './common-result'
import {SelfResult} from './you-result'

const HellobotResult = (props: ResultProps) => (
  <SelfResult {...props} selfChatOnAdd={true} bottomRowText="Say hi, play puzzles, or ask for help" />
)

export default HellobotResult
