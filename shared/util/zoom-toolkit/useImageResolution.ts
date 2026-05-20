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
  const deps = JSON.stringify(source)
  const [resolvedDeps, setResolvedDeps] = useState('')
  const [resolution, setResolution] = useState<SizeVector<number> | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const isFetching = resolvedDeps !== deps

  const onSuccess = (width: number, height: number) => {
    setResolution({width, height})
    setResolvedDeps(deps)
  }

  const onFailure = (e: Error) => {
    setError(e)
    setResolvedDeps(deps)
  }

  useEffect(() => {
    if (typeof source === 'number') {
      const {width, height} = Image.resolveAssetSource(source)
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
