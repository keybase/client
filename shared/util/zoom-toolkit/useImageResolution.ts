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
  // vendored code with an eslint suppression the compiler refuses to optimize past
  'use no memo'
  const deps = JSON.stringify(source)
  const [resolvedDeps, setResolvedDeps] = useState('')
  const [resolution, setResolution] = useState<SizeVector<number> | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const isFetching = resolvedDeps !== deps

  const onSuccess = (width: number, height: number) => {
    setResolution({width, height})
    setResolvedDeps(deps)
  }

  const onFailure = (e: unknown) => {
    setError(e instanceof Error ? e : new Error(String(e)))
    setResolvedDeps(deps)
  }

  useEffect(() => {
    if (typeof source === 'number') {
      const resolved = Image.resolveAssetSource(source)
      if (resolved?.width === undefined || resolved.height === undefined) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        onFailure(new Error(`Unable to resolve asset source ${source}`))
        return
      }
      onSuccess(resolved.width, resolved.height)
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
