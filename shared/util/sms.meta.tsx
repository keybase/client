/* eslint-disable sort-keys */
export type SMSResult = 0 | 1 | 2 | 3

export const smsResults: {[K in string]: SMSResult} = {
  CANCELLED: 0,
  SENT: 1,
  FAILED: 2,
  UNKNOWN: 3, // catch-all for 'message opened'
}
