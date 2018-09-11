#!/usr/bin/env iced
fs = require 'fs'
stringify = require 'json-stable-stringify'
CSON = require 'cson'
{docopt} = require 'docopt'

doc = """
Convert pvl cson docs to a json pvl_kit.

Example:
  ./tool.iced

Usage:
  tool.iced
  tool.iced --help
"""

options = docopt doc

die = (msg) ->
  console.log msg
  process.exit 1

parse_cson = (filepath) ->
  # read the cson file
  pvl_obj = CSON.parseCSONFile filepath
  if 'filename' of pvl_obj
    console.log "error decoding"
    die pvl_obj.toString()
  return pvl_obj

unix_time = ->
  parseInt( (new Date()).getTime() / 1000 )

main = ->
  # collect cson files into tab
  tab = {}
  await fs.readdir "./tab", defer err, files
  die err if err?
  re = /^(\w*)\.(cson)$/
  for file in files
    groups = file.match(re)
    if groups?
      key = parseInt(groups[1])
      die "nan key: #{groups[1]}" if isNaN(key)
      obj = parse_cson "./tab/#{file}"
      tab[key] = obj
      console.log "added: tab[#{key}] <- #{file}"
    else
      console.log "IGNORE: #{file}"

  # build kit
  kit = {}
  kit.kit_version = 1
  kit.ctime = unix_time()
  kit.tab = tab

  # write to file
  kit_json = JSON.stringify kit
  kit_path = "./kit.json"
  await fs.writeFile kit_path, (kit_json + "\n"), defer err
  die err if err?
  console.log "WROTE #{kit_path}"

do main
