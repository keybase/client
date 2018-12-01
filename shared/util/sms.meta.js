// @flow
export type SMSResult = 0 | 1 | 2 | 3

export const smsResults: {[string]: SMSResult} = {
  CANCELLED: 0,
  FAILED: 2,
  SENT: 1,
  UNKNOWN: 3, // catch-all for 'message opened'
}
