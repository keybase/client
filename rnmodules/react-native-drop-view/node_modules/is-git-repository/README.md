# is-git-repository

[![Build Status](https://travis-ci.com/JPeer264/node-is-git-repository.svg?branch=main)](https://travis-ci.com/JPeer264/node-is-git-repository)
[![Build status](https://ci.appveyor.com/api/projects/status/candvk0h292r03q2?svg=true)](https://ci.appveyor.com/project/JPeer264/node-is-git-repository)
[![Coverage Status](https://coveralls.io/repos/github/JPeer264/node-is-git-repository/badge.svg?branch=main)](https://coveralls.io/github/JPeer264/node-is-git-repository?branch=main)

Checks synchronously if a specific directory is a git repository

## Installation

```sh
$ npm i is-git-repository --save
```
or
```sh
$ yarn add is-git-repository
```

## Usage

```js
const isGit = require('is-git-repository');

isGit(); // true or false of process.cwd()
isGit('any/git/repo'); // true or false
```

## LICENSE

MIT © [Jan Peer Stöcklmair](https://www.jpeer.at)
