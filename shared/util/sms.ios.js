// @flow
import {MessageUI} from 'RCTMessageUI'

const openSMS = (phoneno: string, body?: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    MessageUI.showMessageComposeWithOptions(
      {
        body,
        recipients: [phoneno],
      },
      (error, messageComposeResult) => {
        if (error) {
          reject(error)
        } else {
          resolve(messageComposeResult)
        }
      }
    )
  })
}

export default openSMS
