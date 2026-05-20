import {useEffect, useState} from 'react'
import {Image} from 'react-native'
import type {SizeVector} from './types'

type Source = {uri: string; headers?: Record<string, string>}

export type FetchImageResolutionResult = {
  isFetching: boolean
  resolution: SizeVector<number> | undefined
  error: Error | undefined
}

export default function useImageResolution(source: Source | number): FetchImageResolutionResult {
  const [isFetching, setIsFetching] = useState<boolean>(true)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [resolution, setResolution] = useState<SizeVector<number> | undefined>(undefined)

  const onSuccess = (width: number, height: number) => {
    setResolution({width, height})
    setIsFetching(false)
  }

  const onFailure = (e: Error) => {
    setError(e)
    setIsFetching(false)
  }

  const deps = JSON.stringify(source)
  useEffect(() => {
    setIsFetching(true)
    if (typeof source === 'number') {
      const {width, height} = Image.resolveAssetSource(source)
      onSuccess(width, height)
      return
    }
    if (source.headers === undefined) {
      Image.getSize(source.uri, onSuccess, onFailure)
      return
    }
    Image.getSizeWithHeaders(source.uri, source.headers, onSuccess, onFailure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])

  return {isFetching, resolution, error}
}
