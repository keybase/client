import * as SMS from 'expo-sms'

const openSMS = (phonenos: Array<string>, body?: string): Promise<any> => {
  return SMS.isAvailableAsync().then(isAvailable => {
    if (!isAvailable) {
      throw new Error('SMS not available')
    }
    return SMS.sendSMSAsync(phonenos, body || '')
  })
}

export default openSMS
