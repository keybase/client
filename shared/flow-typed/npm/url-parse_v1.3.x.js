// flow-typed signature: 07a2eb886d10cf8034bdac06431b5f65
// flow-typed version: ad6c27f80a/url-parse_v1.3.x/flow_>=v0.59.x

declare module 'url-parse' {
  declare export type Url = {
    protocol: string,
    slashes: boolean,
    auth: string,
    username: string,
    password: string,
    host: string,
    hostname: string,
    port: string,
    pathname: string,
    query: Object,
    hash: string,
    href: string,
    origin: string,
    set: (part: string, value: mixed, fn?: (boolean | (value: mixed) => Object)) => Url,
    toString: () => string,
    lolcation: (loc?: (Object | string)) => Object,
  };

  // In the library, if location is not (Object | string), it is assigned to parser. Therefore,
  // to make less confusing for the user, we type both signatures
  declare type UrlConstructor =
    & ((adress: string, location: (Object | string), parser?: (boolean | string => Object)) => Url)
    & ((adress: string, parser?: (boolean | string => Object)) => Url);

  declare export default UrlConstructor;
}
