#!/usr/bin/env iced

minimist = require 'minimist'
fs = require 'fs'
{make_esc} = require 'iced-error'
{a_json_parse} = require('iced-utils').util
log = require 'iced-logger'
path = require 'path'

#====================================================================

class GoEmitter

  go_export_case : (n) -> n[0].toUpperCase() + n[1...]
  go_package : (n) -> n.replace(/-/g, "_")

  constructor : () ->
    @_code = []
    @_tabs = 0
    @_cache = {}
    @_package

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
      @emit_type t

  emit_type : (t) ->
    return if @_cache[t.name]
    switch t.type
      when "record"
        @emit_record t
      when "fixed"
        @emit_fixed t
    @_cache[t.name] = true

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

  run : (files, cb) ->
    esc = make_esc cb, "run"
    for f in files
      await @run_file f, esc defer()
    src = @_code.join("\n")
    cb null, src

  emit_package : (json, cb) ->
    pkg = @go_package json.namespace
    err = null
    if @_pkg? and pkg isnt @_pkg
      err = new Error "package mismatch: #{@_pkg} != #{pkg}"
    else if not @_pkg?
      @output "package #{pkg}"
      @_pkg = pkg
    cb err

  run_file : (json, cb) ->
    esc = make_esc cb, "run_file"
    await @emit_package json, esc defer()
    @emit_types json.types
    @emit_interface json.protocol, json.messages
    cb null

#====================================================================

class Runner

  constructor : () ->
    @files = []
    @emitter = null
    @jsons = []
    @output = null

  parse_args : (argv, cb) ->
    err = null
    @argv = minimist argv
    if not (@dir = @argv.d)? and not (@files = @argv._).length
      err = new Error "no dir given by -d or input files passed as arguments"
    else if not (@targ = @argv.t)?
      err = new Error "no language target via -t"
    else
      @output = @argv.o
      switch @targ
        when "go"
          @emitter = new GoEmitter
        else
          err = new Error "Unknown language target; I support {go}"
    cb err

  list_dir : (cb) ->
    esc = make_esc cb, "list_dir"
    await fs.readdir @dir, esc defer files
    for f in files when f.match /\.json$/
      @files.push path.join @dir, f
    cb null

  load_files : (cb) ->
    esc = make_esc cb, "load_files"
    if @dir?
      await @list_dir esc defer()
    for f in @files
      await @load_json f, esc defer()
    cb null

  load_json : (f, cb) ->
    esc = make_esc cb, "load_json"
    await fs.readFile f, esc defer raw
    await a_json_parse raw, esc defer json
    @jsons.push json
    cb null

  output_src : (src, cb) ->
    err = null
    if @output?
      await fs.writeFile @output, src, defer err
    else
      console.log src
    cb err

  run : (argv, cb) ->
    esc = make_esc cb, "main"
    await @parse_args argv, esc defer()
    await @load_files esc defer()
    await @emitter.run @jsons, esc defer src
    await @output_src src, esc defer()
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
