// @flow
let envJson = {}
if (process.env.KEYBASE_LOCAL_DEBUG_JSON) {
  try {
    envJson = JSON.parse(process.env.KEYBASE_LOCAL_DEBUG_JSON)
  } catch (e) {
    envJson = {}
    console.warn('Invalid KEYBASE_LOCAL_DEBUG_JSON:', e)
  }
}

export const dumbFilter = envJson.dumbFilter || ''

// the following only apply to mobile:
export const dumbIndex = 30
export const dumbFullscreen = false
