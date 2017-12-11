// flow-typed signature: 4d9e8253b9b9c1a25b55cc2d1f40b40e
// flow-typed version: 77852b4474/del_v3.x.x/flow_>=v0.25.x

type $npm$del$Patterns = string[] | string;

type $npm$del$Options = {
  force?: boolean,
  dryRun?: boolean,
  concurrency?: number,

  // remaining options are passed through to node-glob:
  cwd?: string,
  root?: string,
  dot?: boolean,
  nomount?: boolean,
  mark?: boolean,
  nosort?: boolean,
  stat?: boolean,
  silent?: boolean,
  strict?: boolean,
  cache?: Object,
  statCache?: Object,
  symlinks?: Object,
  realpathCache?: Object,
  nounique?: boolean,
  nonull?: boolean,
  debug?: boolean,
  nobrace?: boolean,
  noglobstar?: boolean,
  noext?: boolean,
  nocase?: boolean,
  matchBase?: boolean,
  nodir?: boolean,
  ignore?: string | string[],
  follow?: boolean,
  realpath?: boolean,
  absolute?: boolean
};

declare module "del" {
  declare class Del {
    (
      patterns: $npm$del$Patterns,
      options?: $npm$del$Options
    ): Promise<string[]>,
    sync(patterns: $npm$del$Patterns, options?: $npm$del$Options): string[]
  }

  declare module.exports: Del;
}
