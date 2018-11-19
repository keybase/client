// flow-typed signature: 2795c40d7224062bf0980781a3d4dad0
// flow-typed version: 7f95efe47a/webpack_v4.x.x/flow_>=v0.71.x

declare module 'webpack' {
  declare class WebpackError extends Error {
    constructor(message: string): WebpackError;
    inspect(): string;
  }

  declare type WebpackCompiler = {
    // <...>
  };

  declare type WebpackMultiCompiler = {
    // <...>
  };

  declare class WebpackCompilation {
    constructor(compiler: WebpackCompiler): WebpackCompilation;
    // <...>
  }

  declare class WebpackStats {
    constructor(compilation: WebpackCompilation): WebpackStats;
    // <...>
  }

  declare type NonEmptyArrayOfUniqueStringValues = Array<string>;

  declare type EntryObject = {
    [k: string]: string | NonEmptyArrayOfUniqueStringValues,
  };

  declare type EntryItem = string | NonEmptyArrayOfUniqueStringValues;

  declare type EntryStatic = EntryObject | EntryItem;

  declare type EntryDynamic = () => EntryStatic | Promise<EntryStatic>;

  declare type Entry = EntryDynamic | EntryStatic;

  declare type ArrayOfStringValues = Array<string>;

  declare type ExternalItem =
    | string
    | {
        [k: string]:
          | string
          | {
              [k: string]: any,
            }
          | ArrayOfStringValues
          | boolean,
      }
    | RegExp;

  declare type Externals =
    | ((
        context: string,
        request: string,
        callback: (err?: Error, result?: string) => void
      ) => void)
    | ExternalItem
    | Array<
        | ((
            context: string,
            request: string,
            callback: (err?: Error, result?: string) => void
          ) => void)
        | ExternalItem
      >;

  declare type RuleSetCondition =
    | RegExp
    | string
    | ((value: string) => boolean)
    | RuleSetConditions
    | {
        and?: RuleSetConditions,
        exclude?: RuleSetConditionOrConditions,
        include?: RuleSetConditionOrConditions,
        not?: RuleSetConditions,
        or?: RuleSetConditions,
        test?: RuleSetConditionOrConditions,
      };

  declare type RuleSetConditions = Array<RuleSetCondition>;

  declare type RuleSetConditionOrConditions =
    | RuleSetCondition
    | RuleSetConditions;

  declare type RuleSetLoader = string;

  declare type RuleSetQuery = { [k: string]: any } | string;

  declare type RuleSetUseItem =
    | RuleSetLoader
    | Function
    | {
        ident?: string,
        loader?: RuleSetLoader,
        options?: RuleSetQuery,
        query?: RuleSetQuery,
      };

  declare type RuleSetUse = RuleSetUseItem | Function | Array<RuleSetUseItem>;

  declare type RuleSetRule = {
    compiler?: RuleSetConditionOrConditions,
    enforce?: 'pre' | 'post',
    exclude?: RuleSetConditionOrConditions,
    include?: RuleSetConditionOrConditions,
    issuer?: RuleSetConditionOrConditions,
    loader?: RuleSetLoader | RuleSetUse,
    loaders?: RuleSetUse,
    oneOf?: RuleSetRules,
    options?: RuleSetQuery,
    parser?: {
      [k: string]: any,
    },
    query?: RuleSetQuery,
    resolve?: ResolveOptions,
    resource?: RuleSetConditionOrConditions,
    resourceQuery?: RuleSetConditionOrConditions,
    rules?: RuleSetRules,
    sideEffects?: boolean,
    test?: RuleSetConditionOrConditions,
    type?:
      | 'javascript/auto'
      | 'javascript/dynamic'
      | 'javascript/esm'
      | 'json'
      | 'webassembly/experimental',
    use?: RuleSetUse,
  };

  declare type RuleSetRules = Array<RuleSetRule>;

  declare type ModuleOptions = {
    defaultRules?: RuleSetRules,
    exprContextCritical?: boolean,
    exprContextRecursive?: boolean,
    exprContextRegExp?: boolean | RegExp,
    exprContextRequest?: string,
    noParse?: Array<RegExp> | RegExp | Function | Array<string> | string,
    rules?: RuleSetRules,
    strictExportPresence?: boolean,
    strictThisContextOnImports?: boolean,
    unknownContextCritical?: boolean,
    unknownContextRecursive?: boolean,
    unknownContextRegExp?: boolean | RegExp,
    unknownContextRequest?: string,
    unsafeCache?: boolean | Function,
    wrappedContextCritical?: boolean,
    wrappedContextRecursive?: boolean,
    wrappedContextRegExp?: RegExp,
  };

  declare type NodeOptions = {
    Buffer?: false | true | 'mock',
    __dirname?: false | true | 'mock',
    __filename?: false | true | 'mock',
    console?: false | true | 'mock',
    global?: boolean,
    process?: false | true | 'mock',
    [k: string]: false | true | 'mock' | 'empty',
  };

  declare type WebpackPluginFunction = (compiler: WebpackCompiler) => void;

  declare type WebpackPluginInstance = {
    apply: WebpackPluginFunction,
    [k: string]: any,
  };

  declare type OptimizationSplitChunksOptions = {
    automaticNameDelimiter?: string,
    cacheGroups?: {
      [k: string]:
        | false
        | Function
        | string
        | RegExp
        | {
            automaticNameDelimiter?: string,
            automaticNamePrefix?: string,
            chunks?: ('initial' | 'async' | 'all') | Function,
            enforce?: boolean,
            filename?: string,
            maxAsyncRequests?: number,
            maxInitialRequests?: number,
            maxSize?: number,
            minChunks?: number,
            minSize?: number,
            name?: boolean | Function | string,
            priority?: number,
            reuseExistingChunk?: boolean,
            test?: Function | string | RegExp,
          },
    },
    chunks?: ('initial' | 'async' | 'all') | Function,
    fallbackCacheGroup?: {
      automaticNameDelimiter?: string,
      maxSize?: number,
      minSize?: number,
    },
    filename?: string,
    hidePathInfo?: boolean,
    maxAsyncRequests?: number,
    maxInitialRequests?: number,
    maxSize?: number,
    minChunks?: number,
    minSize?: number,
    name?: boolean | Function | string,
  };

  declare type OptimizationOptions = {
    checkWasmTypes?: boolean,
    chunkIds?: 'natural' | 'named' | 'size' | 'total-size' | false,
    concatenateModules?: boolean,
    flagIncludedChunks?: boolean,
    hashedModuleIds?: boolean,
    mangleWasmImports?: boolean,
    mergeDuplicateChunks?: boolean,
    minimize?: boolean,
    minimizer?: Array<WebpackPluginInstance | WebpackPluginFunction>,
    moduleIds?: 'natural' | 'named' | 'hashed' | 'size' | 'total-size' | false,
    namedChunks?: boolean,
    namedModules?: boolean,
    noEmitOnErrors?: boolean,
    nodeEnv?: false | string,
    occurrenceOrder?: boolean,
    portableRecords?: boolean,
    providedExports?: boolean,
    removeAvailableModules?: boolean,
    removeEmptyChunks?: boolean,
    runtimeChunk?:
      | boolean
      | ('single' | 'multiple')
      | {
          name?: string | Function,
        },
    sideEffects?: boolean,
    splitChunks?: false | OptimizationSplitChunksOptions,
    usedExports?: boolean,
  };

  declare type LibraryCustomUmdObject = {
    amd?: string,
    commonjs?: string,
    root?: string | ArrayOfStringValues,
  };

  declare type OutputOptions = {
    auxiliaryComment?:
      | string
      | {
          amd?: string,
          commonjs?: string,
          commonjs2?: string,
          root?: string,
        },
    chunkCallbackName?: string,
    chunkFilename?: string,
    chunkLoadTimeout?: number,
    crossOriginLoading?: false | 'anonymous' | 'use-credentials',
    devtoolFallbackModuleFilenameTemplate?: string | Function,
    devtoolLineToLine?: boolean | { [k: string]: any },
    devtoolModuleFilenameTemplate?: string | Function,
    devtoolNamespace?: string,
    filename?: string | Function,
    globalObject?: string,
    hashDigest?: string,
    hashDigestLength?: number,
    hashFunction?: string | Function,
    hashSalt?: string,
    hotUpdateChunkFilename?: string | Function,
    hotUpdateFunction?: string,
    hotUpdateMainFilename?: string | Function,
    jsonpFunction?: string,
    jsonpScriptType?: false | 'text/javascript' | 'module',
    library?: string | Array<string> | LibraryCustomUmdObject,
    libraryExport?: string | ArrayOfStringValues,
    libraryTarget?:
      | 'var'
      | 'assign'
      | 'this'
      | 'window'
      | 'self'
      | 'global'
      | 'commonjs'
      | 'commonjs2'
      | 'commonjs-module'
      | 'amd'
      | 'amd-require'
      | 'umd'
      | 'umd2'
      | 'jsonp',
    path?: string,
    pathinfo?: boolean,
    publicPath?: string | Function,
    sourceMapFilename?: string,
    sourcePrefix?: string,
    strictModuleExceptionHandling?: boolean,
    umdNamedDefine?: boolean,
    webassemblyModuleFilename?: string,
  };

  declare type PerformanceOptions = {
    assetFilter?: Function,
    hints?: false | 'warning' | 'error',
    maxAssetSize?: number,
    maxEntrypointSize?: number,
  };

  declare type ArrayOfStringOrStringArrayValues = Array<string | Array<string>>;

  declare type ResolveOptions = {
    alias?:
      | { [k: string]: string }
      | Array<{
          alias?: string,
          name?: string,
          onlyModule?: boolean,
        }>,
    aliasFields?: ArrayOfStringOrStringArrayValues,
    cachePredicate?: Function,
    cacheWithContext?: boolean,
    concord?: boolean,
    descriptionFiles?: ArrayOfStringValues,
    enforceExtension?: boolean,
    enforceModuleExtension?: boolean,
    extensions?: ArrayOfStringValues,
    fileSystem?: { [k: string]: any },
    mainFields?: ArrayOfStringOrStringArrayValues,
    mainFiles?: ArrayOfStringValues,
    moduleExtensions?: ArrayOfStringValues,
    modules?: ArrayOfStringValues,
    plugins?: Array<WebpackPluginInstance | WebpackPluginFunction>,
    resolver?: { [k: string]: any },
    symlinks?: boolean,
    unsafeCache?: boolean | { [k: string]: any },
    useSyncFileSystemCalls?: boolean,
  };

  declare type FilterItemTypes = RegExp | string | Function;

  declare type FilterTypes = FilterItemTypes | Array<FilterItemTypes>;

  declare type StatsOptions = {
    all?: boolean,
    assets?: boolean,
    assetsSort?: string,
    builtAt?: boolean,
    cached?: boolean,
    cachedAssets?: boolean,
    children?: boolean,
    chunkGroups?: boolean,
    chunkModules?: boolean,
    chunkOrigins?: boolean,
    chunks?: boolean,
    chunksSort?: string,
    colors?:
      | boolean
      | {
          bold?: string,
          cyan?: string,
          green?: string,
          magenta?: string,
          red?: string,
          yellow?: string,
        },
    context?: string,
    depth?: boolean,
    entrypoints?: boolean,
    env?: boolean,
    errorDetails?: boolean,
    errors?: boolean,
    exclude?: FilterTypes | boolean,
    excludeAssets?: FilterTypes,
    excludeModules?: FilterTypes | boolean,
    hash?: boolean,
    maxModules?: number,
    moduleAssets?: boolean,
    moduleTrace?: boolean,
    modules?: boolean,
    modulesSort?: string,
    nestedModules?: boolean,
    optimizationBailout?: boolean,
    outputPath?: boolean,
    performance?: boolean,
    providedExports?: boolean,
    publicPath?: boolean,
    reasons?: boolean,
    source?: boolean,
    timings?: boolean,
    usedExports?: boolean,
    version?: boolean,
    warnings?: boolean,
    warningsFilter?: FilterTypes,
  };

  declare type WebpackOptions = {
    amd?: { [k: string]: any },
    bail?: boolean,
    cache?: boolean | { [k: string]: any },
    context?: string,
    dependencies?: Array<string>,
    devServer?: { [k: string]: any },
    devtool?: string | false,
    entry?: Entry,
    externals?: Externals,
    loader?: { [k: string]: any },
    mode?: 'development' | 'production' | 'none',
    module?: ModuleOptions,
    name?: string,
    node?: false | NodeOptions,
    optimization?: OptimizationOptions,
    output?: OutputOptions,
    parallelism?: number,
    performance?: false | PerformanceOptions,
    plugins?: Array<WebpackPluginInstance | WebpackPluginFunction>,
    profile?: boolean,
    recordsInputPath?: string,
    recordsOutputPath?: string,
    recordsPath?: string,
    resolve?: ResolveOptions,
    resolveLoader?: ResolveOptions,
    serve?: { [k: string]: any },
    stats?:
      | StatsOptions
      | boolean
      | (
          | 'none'
          | 'errors-only'
          | 'minimal'
          | 'normal'
          | 'detailed'
          | 'verbose'
        ),
    target?:
      | 'web'
      | 'webworker'
      | 'node'
      | 'async-node'
      | 'node-webkit'
      | 'electron-main'
      | 'electron-renderer'
      | ((compiler: WebpackCompiler) => void),
    watch?: boolean,
    watchOptions?: {
      aggregateTimeout?: number,
      ignored?: { [k: string]: any },
      poll?: boolean | number,
      stdin?: boolean,
    },
  };

  declare module.exports: (
    options: WebpackOptions,
    callback: (error: WebpackError, stats: WebpackStats) => void
  ) => WebpackCompiler | WebpackMultiCompiler;
}
