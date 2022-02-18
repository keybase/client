import * as SMS from 'expo-sms'

const openSMS = async (phonenos: Array<string>, body?: string): Promise<any> => {
  return SMS.isAvailableAsync().then(async isAvailable => {
    if (!isAvailable) {
      throw new Error('SMS not available')
    }
    return SMS.sendSMSAsync(phonenos, body || '')
  })
}

export default openSMS
