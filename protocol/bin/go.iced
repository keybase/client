#!/usr/bin/env iced

minimist = require 'minimist'
fs = require 'fs'
{make_esc} = require 'iced-error'
{a_json_parse} = require('iced-utils').util
log = require 'iced-logger'
path = require 'path'

#====================================================================

class GoEmitter

  go_export_case : (n) ->
    ret = n[0].toUpperCase() + n[1...]
    @go_lint_capitalize ret

  go_lint_capitalize : (n) ->
    n = n.replace /pgp/g, "PGP"
    n = n.replace /Pgp/g, "PGP"
    n

  go_package : (n) -> n.replace(/[.-]/g, "")

  go_primitive_type : (m) ->
    map =
      boolean : "bool"
      bytes : "[]byte"
      long : "int64"
      float : "float32"
      double : "float64"
    map[m] or m

  constructor : () ->
    @_code = []
    @_tabs = 0
    @_cache = {}
    @_pkg = null

  tabs : () -> ("\t" for i in [0...@_tabs]).join("")
  output : (l) ->
    @_code.push (@tabs() + l)
    @_code.push("") if (l is "}" or l is ")") and @_tabs is 0

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
      else if t.type is "map" then "map[string]" + @go_primitive_type(t.values)
      else "ERROR"
    else "ERROR"
    { type , optional }


  #
  # An example of an AVDL "typedef":
  #
  # @typedef("string")
  # record Obj {}
  #
  emit_typedef : (t) ->
    @output "type #{t.name} #{@emit_field_type(t.typedef).type}"
    true

  emit_record : (json, {wrapper} ) ->
    @output "type #{@go_export_case(json.name)} struct {"
    @tab()
    @emit_wrapper_record_first() if wrapper
    for f in json.fields
      {type, optional } = @emit_field_type(f.type)
      omitempty = if optional then ",omitempty" else ""
      @output [
        @go_export_case(f.name),
        @go_lint_capitalize(type),
        "`codec:\"#{f.name}#{omitempty}\" json:\"#{f.name}#{omitempty}\"`"
      ].join "\t"
    @untab()
    @output "}"

  emit_fixed : (t) ->
    @output "type #{t.name} [#{t.size}]byte"

  emit_types : (json) ->
    for t in json
      @emit_type t

  emit_type : (t) ->
    return if @_cache[t.name]
    switch t.type
      when "record"
        if t.typedef
          @emit_typedef t
        else
          @emit_record t, {}
      when "fixed"
        @emit_fixed t
      when "enum"
        @emit_enum t

    @_cache[t.name] = true

  emit_enum : (t) ->
    @output "type #{t.name} int"
    @output "const ("
    @tab()
    for s, i in t.symbols
      i = s.split("_").pop(-1);
      s = s.replace("_" + i, "");
      @output "#{t.name}_#{s} #{t.name} = #{i}"
    @untab()
    @output ")"

  emit_wrapper_objects : (messages) ->
    for k,v of messages
      @emit_wrapper_object k, v

  emit_wrapper_object : (name, details) ->
    args = details.request
    klass_name = @go_export_case(name) + "Arg"
    obj =
      name : klass_name
      fields : args
    @emit_record obj, {}
    details.request = {
      type : klass_name
      name : "__arg"
      wrapper : true
      nargs : args.length
      single : if args.length is 1 then args[0] else null
    }

  emit_interface : (protocol, messages) ->
    @emit_wrapper_objects messages
    @emit_interface_server protocol, messages
    @emit_interface_client protocol, messages

  emit_interface_client : (protocol, messages) ->
    p = @go_export_case protocol
    @output "type #{p}Client struct {"
    @tab()
    @output "Cli GenericClient"
    @untab()
    @output "}"
    for k,v of messages
      @emit_message_client protocol, k,v, false

  run : (files, cb) ->
    esc = make_esc cb, "run"
    for f in files
      await @run_file f, esc defer()
    src = @_code.join("\n")
    cb null, {"": src}

  emit_generic_client : () ->
    @output "type GenericClient interface {"
    @tab()
    @output "Call(ctx context.Context, s string, args interface{}, res interface{}) error"
    @output "Notify(ctx context.Context, s string, args interface{}) error"
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
      @emit_imports()
      @untab()
      @output ")"
      @output ""
      @emit_generic_client()
      @_pkg = pkg
    cb err

  emit_imports : () ->
    @output 'rpc "github.com/keybase/go-framed-msgpack-rpc"'
    @output 'context "golang.org/x/net/context"'

  emit_interface_server : (protocol, messages) ->
    p = @go_export_case protocol
    @output "type #{p}Interface interface {"
    @tab()
    for k,v of messages
      @emit_message_server k,v
    @untab()
    @output "}"
    @emit_protocol_server protocol, messages

  emit_server_hook : (name, details) ->
    arg = details.request
    res = details.response
    resvar = if res is "null" then "" else "ret, "
    @output """"#{name}": {"""
    @tab()
    @emit_server_hook_make_arg name, details
    @emit_server_hook_make_handler name, details
    @emit_server_hook_method_type name, details
    @untab()
    @output "},"

  emit_server_hook_make_arg : (name, details) ->
    arg = details.request
    @output "MakeArg: func() interface{} {"
    @tab()

    # Over the wire, we're expecting either an empty argument array,
    # or an array with one T in it. So we have to pass the decoder
    # a pointer to a slice of T's. This is a little bit convoluted
    # but we're obeying the msgpack spec (which says RPCs take arrays
    # of arguments) and also the library's attempts to avoid unnecessary
    # copies of objects as they are passed from MakeArg, through the
    # decoder, and back into the Handler specified below.
    @output "ret := make([]#{@go_primitive_type(arg.type)}, 1)"
    @output "return &ret"
    @untab()
    @output "},"

  emit_server_hook_method_type : (name, details) ->
    @output "MethodType: rpc.Method#{if details.notify? then 'Notify' else 'Call'},"

  emit_server_hook_make_handler : (name, details) ->
    arg = details.request
    res = details.response
    resvar = if res is "null" then "" else "ret, "
    pt = @go_primitive_type arg.type
    @output "Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {"
    @tab()
    if arg.nargs > 0
      @output "typedArgs, ok := args.(*[]#{pt})"
      @output "if !ok {"
      @tab()
      @output "err = rpc.NewTypeError((*[]#{pt})(nil), args)"
      @output "return"
      @untab()
      @output "}"
    farg = if arg.nargs is 0 then ''
    else
      access = if arg.nargs is 1 then ".#{@go_export_case arg.single.name}" else ''
      "(*typedArgs)[0]#{access}"
    @output "#{resvar}err = i.#{@go_export_case(name)}(ctx, #{farg})"
    @output "return"
    @untab()
    @output "},"

  emit_protocol_server : (protocol, messages) ->
    p = @go_export_case protocol
    @output "func #{p}Protocol(i #{p}Interface) rpc.Protocol {"
    @tab()
    @output "return rpc.Protocol {"
    @tab()
    @output """Name: "#{@_pkg}.#{protocol}","""
    @output "Methods: map[string]rpc.ServeHandlerDescription{"
    @tab()
    for k,v of messages
      @emit_server_hook k, v
    @untab()
    @output "},"
    @untab()
    @output "}"
    @untab()
    @output "}"

  emit_message_server : (name, details) ->
    arg = details.request
    res = details.response
    args = if arg.nargs then "#{(@emit_field_type (arg.single or arg).type ).type}" else ""
    res_types = []
    if res isnt "null" then res_types.push @go_lint_capitalize(@emit_field_type(res).type)
    res_types.push "error"
    @output "#{@go_export_case(name)}(context.Context, #{args}) (#{res_types.join ","})"

  emit_message_client: (protocol, name, details, async) ->
    p = @go_export_case protocol
    arg = details.request
    res = details.response
    out_list = []
    if res isnt "null"
      out_list.push "res #{@go_lint_capitalize(@emit_field_type(res).type)}"
      res_in = "&res"
    else
      res_in = "nil"
    out_list.push "err error"
    outs = out_list.join ","
    params = if arg.nargs is 0 then ""
    else
      parg = arg.single or arg
      "#{parg.name} #{(@emit_field_type parg.type).type}"
    @output "func (c #{p}Client) #{@go_export_case(name)}(ctx context.Context, #{params}) (#{outs}) {"
    @tab()
    if arg.nargs is 1
      n = arg.single.name
      @output "#{arg.name} := #{arg.type}{ #{@go_export_case n} : #{n} }"
    oarg = "[]interface{}{"
    oarg += if arg.nargs is 0 then "#{arg.type}{}"
    else arg.name
    oarg += "}"
    res = if details.notify? then "" else ", #{res_in}"
    @output """err = c.Cli.#{if details.notify? then "Notify" else "Call"}(ctx, "#{@_pkg}.#{protocol}.#{name}", #{oarg}#{res})"""
    @output "return"
    @untab()
    @output "}"

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
          klass = GoEmitter
          @emitter = new klass
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
