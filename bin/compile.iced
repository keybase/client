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
  go_package : (n) -> n.replace(/[.-]/g, "_")

  go_primitive_type : (m) ->
    map =
      boolean : "bool"
      bytes : "[]byte"
    map[m] or m

  constructor : () ->
    @_code = []
    @_tabs = 0
    @_cache = {}
    @_pkg = null

  tabs : () -> ("\t" for i in [0...@_tabs]).join("")
  output : (l) ->
    @_code.push (@tabs() + l)
    @_code.push("") if l is "}"

  tab : () -> @_tabs++
  untab : () -> @_tabs--

  emit_field_type : (t) ->
    optional = false
    type = if typeof(t) is 'string' then @go_primitive_type(t)
    else if typeof(t) is 'object'
      if Array.isArray(t) and t[0] == "null"
        optional = true
        "*" + @go_primitive_type(t[1])
      else if t.type is "array" then "[]" + @go_primitive_type(t.items)
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

  emit_message_server : (name, details) ->
    arg = details.request[0]
    res = details.response
    args = "arg *#{arg.type}, res *#{res}"
    @output "#{@go_export_case(name)}(#{args}) error"

  emit_message_client : (protocol, name, details, async) ->
    p = @go_export_case protocol
    arg = details.request[0]
    res = details.response
    ap = if async then "Async" else ""
    call = if async then "Go" else "Call"
    @output "func (c #{p}Client) #{ap}#{@go_export_case(name)}(arg #{arg.type}, res *#{res}) error {"
    @tab()
    @output """return c.#{call}("#{@_pkg}.#{protocol}.#{name}", arg, res)"""
    @untab()
    @output "}"

  emit_interface : (protocol, messages) ->
    @emit_interface_server protocol, messages
    @emit_interface_client protocol, messages

  emit_interface_client : (protocol, messages) ->
    p = @go_export_case protocol
    @output "type #{p}Client struct {"
    @tab()
    @output "cli GenericClient"
    @untab()
    @output "}"
    for k,v of messages
      @emit_message_client protocol, k,v, false

  emit_interface_server : (protocol, messages) ->
    p = @go_export_case protocol
    @output "type #{p}Interface interface {"
    @tab()
    for k,v of messages
      @emit_message_server k,v
    @untab()
    @output "}"
    @output "func Register#{p}(server *rpc.Server, i #{p}Interface) error {"
    @tab()
    @output """return server.RegisterName("#{@_pkg}.#{protocol}", i)"""
    @untab()
    @output "}"

  run : (files, cb) ->
    esc = make_esc cb, "run"
    for f in files
      await @run_file f, esc defer()
    src = @_code.join("\n")
    cb null, {"": src}

  emit_generic_client : () ->
    @output "type GenericClient interface {"
    @tab()
    @output "Call(s string, args interface{}, res interface{}) error"
    @untab()
    @output "}"

  emit_package : (json, cb) ->
    pkg = json.namespace
    err = null
    if @_pkg? and pkg isnt @_pkg
      err = new Error "package mismatch: #{@_pkg} != #{pkg}"
    else if not @_pkg?
      @output "package #{@go_package pkg}"
      @output "import ("
      @tab()
      @output '"net/rpc"'
      @untab()
      @output ")"
      @output ""
      @emit_generic_client()
      @_pkg = pkg
    cb err

  run_file : (json, cb) ->
    esc = make_esc cb, "run_file"
    await @emit_package json, esc defer()
    @emit_types json.types
    @emit_interface json.protocol, json.messages
    cb null

#====================================================================

class ObjCEmitter

  constructor : () ->
    @_header = []
    @_impl = []
    @_cache = {}
    @_fixed = []

  emit_field_type : (t) ->
    type = if typeof(t) is "string"
      if t == "string" then "@property NSString *"
      else if t == "int" then "@property NSInteger "
      else
        if t in @_fixed then "@property NSData *"
        else "@property KB#{t} *"
    else if typeof(t) is 'object'
      if Array.isArray(t) and t[0] == "null"
        "@property KB#{t[1]} *"
      else if t.type is "array" then "@property NSArray *"
      else "ERROR"
    else "ERROR"
    type

  emit_record : (json) ->
    @_impl.push "@implementation KB#{json.name}"
    @_impl.push "@end"
    @_header.push "@interface KB#{json.name} : KBRObject"
    for f in json.fields
      @_header.push @emit_field_type(f.type) + f.name + ";"
    @_header.push "@end\n"

  emit_fixed : (t) ->
    @_fixed.push t.name

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

  emit_interface : (protocol, messages) ->
    # Nothing yet

  run : (files, cb) ->
    esc = make_esc cb, "run"
    for f in files
      await @run_file f, esc defer()

    @_header.push "import \"KBRObject.h\""
    h_src = @_header.join("\n")

    @_impl.push "import \"KBRPC.h\"" # Need to use the filename passed in
    m_src = @_impl.join("\n")

    cb null, {".h": h_src, ".m": m_src}

  emit_package : (json, cb) ->
    # No namespace support in Objective-C
    cb null

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
        when "objc"
          @emitter = new ObjCEmitter
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
      for ext, data of src
        await fs.writeFile "#{@output}#{ext}", data, defer err
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
