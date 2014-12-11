#!/usr/bin/env iced

minimist = require 'minimist'
fs = require 'fs'
{make_esc} = require 'iced-error'
{a_json_parse} = require('iced-utils').util
log = require 'iced-logger'

#====================================================================

class GoEmitter

  go_export_case : (n) -> n[0].toUpperCase() + n[1...]

  constructor : () ->
    @_code = []
    @_tabs = 0

  tabs : () -> ("\t" for i in [0...@_tabs]).join("")
  output : (l) -> @_code.push (@tabs() + l)

  tab : () -> @_tabs++
  untab : () -> @_tabs--

  emit_field_type : (t) ->
    optional = false
    type = if typeof(t) is 'string' then t
    else if typeof(t) is 'object'
      if Array.isArray(t) and t[0] == "null"
        optional = true
        "*" + t[1]
      else if t.type is "array" then "[]" + t.items
      else "ERROR"
    else "ERROR"
    { type , optional }

  emit_record : (json) ->
    @output "type #{@go_export_case(json.name)} struct {"
    @tab()
    for f in json.fields
      {type, optional } = @emit_field_type(f.type)
      omitempty = if optional then ",omitempty" else ""
      @output [
        @go_export_case(f.name),
        type,
        "`codec:\"#{f.name}#{omitempty}\"`"
      ].join "\t"
    @untab()
    @output "}"

  emit_fixed : (t) ->
    @output "type #{t.name  } [#{t.size}]byte"

  emit_types : (json) ->
    for t in json
      switch t.type
        when "record"
          @emit_record t
        when "fixed"
          @emit_fixed t

  emit_message : (name, details) ->
    args = (a.name + " " + a.type for a in details.request).join ", "
    res = details.response
    @output "#{@go_export_case(name)}(#{args}) #{res}"

  emit_interface : (protocol, messages) ->
    @output "type #{@go_export_case(protocol)} interface {"
    @tab()
    for k,v of messages
      @emit_message k,v
    @untab()
    @output "}"

  run : (json, cb) ->
    @emit_types json.types
    @emit_interface json.protocol, json.messages
    console.log @_code.join("\n")
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
