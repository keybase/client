#!/usr/bin/env iced

minimist = require 'minimist'
fs = require 'fs'
{make_esc} = require 'iced-error'
{a_json_parse} = require('iced-utils').util
log = require 'iced-logger'

#====================================================================

class GoEmitter

  constructor : () ->

  run : (json, cb) ->
    console.log json
    cb null

#====================================================================

class Runner

  constructor : () ->
    @filename = null
    @emitter = null

  parse_args : (argv, cb) ->
    err = null
    @argv = minimist argv
    if not (@filename = @argv.f)?
      err = new Error "no input file given via -f"
    else if not (@targ = @argv.t)?
      err = new Error "no language target via -t"
    else
      switch @targ
        when "go"
          @emitter = new GoEmitter
        else
          err = new Error "Unknown language target; I support {go}"
    cb err

  load_json : (cb) ->
    esc = make_esc cb, "load_json"
    await fs.readFile @filename, esc defer raw
    await a_json_parse raw, esc defer @json
    cb null

  run : (argv, cb) ->
    esc = make_esc cb, "main"
    await @parse_args argv, esc defer()
    await @load_json esc defer()
    await @emitter.run @json, esc defer()
    cb null

#====================================================================

main = (argv) ->
  r = new Runner()
  await r.run argv, defer err
  rc = 0
  if err?
    log.error err
    rc = -2
  process.exit rc

#====================================================================

main process.argv[2...]
