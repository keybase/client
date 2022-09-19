# is-git-dirty

[![Build Status](https://travis-ci.com/JPeer264/node-is-git-dirty.svg?branch=main)](https://travis-ci.com/JPeer264/node-is-git-dirty)
[![Build status](https://ci.appveyor.com/api/projects/status/ehj6762gbj1e2qyc?svg=true)](https://ci.appveyor.com/project/JPeer264/node-is-git-dirty)
[![Coverage Status](https://coveralls.io/repos/github/JPeer264/node-is-git-dirty/badge.svg?branch=main)](https://coveralls.io/github/JPeer264/node-is-git-dirty?branch=main)

Checks synchronously if the git repository is clean. This assumes that no files are added, untracked or modified.

## Installation

```sh
$ npm i is-git-dirty --save
```
or
```sh
$ yarn add is-git-dirty
```

## Usage

Returns:
- `null`: Directory is not a git repository
- `true`: Files are added, untracked or modified
- `false`: No files are added, untracked or modified. Git is clean

```js
const isGitDirty = require('is-git-dirty');

isGitDirty(); // true or false of process.cwd()
isGitDirty('any/git/repo'); // true or false
```

## LICENSE

MIT © [Jan Peer Stöcklmair](https://www.jpeer.at)
