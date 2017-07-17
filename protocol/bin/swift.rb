# encoding: utf-8
#
require "json"

begin
  require "active_support/inflector"
rescue LoadError
  puts "You need to install active support: gem install activesupport"
  exit 1
end

script_path = File.expand_path(File.dirname(__FILE__))

out_dir = nil
if ARGV.length == 1 then
  out_dir = ARGV[0]
  puts "Out dir: #{out_dir}"
else
  puts "No output directory specified"
  exit 1
end

paths = Dir["#{script_path}/../json/keybase1/*.json"]

paths_move = ["#{script_path}/../json/keybase1/common.json",
  "#{script_path}/../json/keybase1/prove_common.json"]
paths_move.reverse.each do |p|
  paths.delete(p)
  paths.unshift(p)
end
# Uses external import, TODO: Fixme
paths.delete("#{script_path}/../json/keybase1/gregor_ui.json")
paths.delete("#{script_path}/../json/keybase1/gregor.json")


@defined_types = []
@enums = []
@aliases = {}

# For Objective-C support
# @annotation = "@objc "
# @model_subclass = ": NSObject"
# @use_nsnumber = true

@annotation = ""
@model_subclass = ""
@use_nsnumber = false


def model_name(type)
  type = @aliases[type] if @aliases[type]
  raise "Unsupported type array" if type == "array"

  case type
  when "int" then "Int"
  when "int64" then "Int64"
  when "long" then "Int64"
  when "float" then "Float"
  when "double" then "Double"
  when "string" then "String"
  when "bytes" then "NSData"
  when "boolean" then "Bool"
  when "bool" then "Bool"
  else
    type
  end
end

def return_type(type)
  type = @aliases[type] if @aliases[type]
  raise "Unsupported type array" if type == "array"

  return "NSNumber" if @use_nsnumber && ["int", "int64", "long", "float", "double", "boolean"].include?(type)

  return model_name(type)
end

def is_objc_primitive(type)
 ["int", "int64", "long", "float", "double", "boolean"].include?(type)
end

def swift_for_type(type)
  subtype = nil
  if type.kind_of?(Hash) # Subtype (for array, map)
    if type["type"] == "array" then
      subtype = type["items"]
      name = "[#{model_name(subtype)}]"
    elsif type["type"] == "map" then
      subtype = type["values"]
      name = "[String: #{model_name(subtype)}]"
    else
      raise "Unsupported subtype"
    end
  else
    type, optional = check_type(type)
    name = model_name(type)
    name += "?" if optional
  end
  name
end

def check_type(type)
  optional = false
  if type.kind_of?(Array)
    raise "Only support unions with null and regular type" if type.length != 2 && type[0] != "null"
    optional = true
    type = type[1]
  end
  type = @aliases[type] if @aliases[type]
  return type, optional
end

def validate_name(name, type, source)
  # if name.start_with?("")
  #   raise "Invalid name: #{name} in #{source}. In Swift you can't start a property name with \"\""
  # end

  case name
  when "where"
    return "whereValue"
  end

  if name == type
    raise "Invalid name: #{name} in #{source}. In Swift the property name != type name (#{name} == #{type})."
  end

  if ["internal", "private", "self"].include?(name)
    raise "Invalid name: #{name} in #{source}. In Swift you can't have a property named \"#{name}\"."
  end

  return name
end

def json_cast(type, optional=false)
  type = @aliases[type] if @aliases[type]
  subtype = nil
  if type.kind_of?(Hash) then
    if type["type"] == "map" then
      subtype = type["values"]
    end
    type = type["type"]
  end

  return ".intValue" if @enums.include?(type)

  case type
  when "int" then ".intValue"
  when "int64" then ".int64Value"
  when "long" then ".int64Value"
  when "float" then ".floatValue"
  when "double" then ".doubleValue"
  when "boolean" then ".boolValue"
  when "string" then ".stringValue"
  when "array" then ".arrayValue"
  when "map" then
    if subtype == "string" then
      ".dictionaryStringValue"
    else
      ".dictionaryValue"
    end
  when "bytes" then ".object as! NSData"
  else
    nil
  end
end

def json_return_statement(rpc_method, cname, type)
  if @enums.include?(type)
    return "let response = try self.sendRequest(method: \"#{rpc_method}\", args: args)
    try checkNull(response: response)
    return #{cname}(rawValue: JSON(response).intValue)!"
  end

  cast = if @use_nsnumber && ["int", "int64", "long", "float", "double", "boolean"].include?(type)
    ".numberValue"
  else
    json_cast(type)
  end

  if cast
    returnStatement = "let response = try self.sendRequest(method: \"#{rpc_method}\", args: args)
    try checkNull(response: response)
    return JSON(response)#{cast}"
  else
    returnStatement = "let response = try self.sendRequest(method: \"#{rpc_method}\", args: args)
    try checkNull(response: response)
    return #{cname}.fromJSON(JSON(response))"
  end
end

def json_return_statement_for_array(rpc_method, item_cname)
  return "let response = try self.sendRequest(method: \"#{rpc_method}\", args: args)
  try checkNull(response: response)
  return #{item_cname}.fromJSONArray(JSON(response).arrayValue)"
end

# def default_value(type)
#   case type
#   when "int", "long", "float"
#     "0"
#   when "boolean"
#     "false"
#   else
#     "nil"
#   end
# end

def json_value(name, type)
  type, optional = check_type(type)

  if type == "bytes"
    #return "NSData()/*TODO: Fixme*/"
  end

  cast = json_cast(type, optional)
  value = if cast
    "json[\"#{name}\"]#{cast}"
  else
    "#{type}.fromJSON(json[\"#{name}\"])"
  end

  if @enums.include?(type)
    value = "#{type}(rawValue: #{value})!"
  end

  if type.kind_of?(Hash) && type["type"] == "array"
    value = "#{model_name(type["items"])}.fromJSONArray(#{value})"
  end

  value
end

def json_init(name, type)
  return "#{name}: #{json_value(name, type)}"
end

def var(name, type, protocol, optional)
  name = validate_name(name, type, protocol)
  return "\tpublic let #{name}: #{type}" + (optional ? "?" : "")
end

def is_any_object(type)
  true
end

def name_for_response_type(response_type)
  if is_objc_primitive(response_type)
    return return_type(response_type)
  else
    return swift_for_type(response_type)
  end
end

def add_methods(impl, namespace, protocol, method, request_params, response_type)
  rpc_method = "#{namespace}.#{protocol}.#{method}"
  dc_method = method.camelize(:lower)

  method_params = []
  dict_params = []
  opt_params = []
  request_params.each_with_index.collect do |param, index|
    rname = param["name"]
    rtype = param["type"]
    next if (rname == "sessionID")
    rname = validate_name(rname, rtype, protocol)

    method_params << "#{rname}: #{swift_for_type(rtype)}"

    rtype, optional = check_type(rtype)
    if @enums.include?(rtype)
      dict_params << "\"#{rname}\": #{rname}.rawValue"
    elsif rtype == "long"
      dict_params << "\"#{rname}\": NSNumber(value: #{rname})"
    elsif rtype == "int"
      dict_params << "\"#{rname}\": NSNumber(value: #{rname})"
    elsif optional
      dict_params << "\"#{rname}\": wrapNull(#{rname})"
    else
      dict_params << "\"#{rname}\": #{rname}"
    end
  end

  if response_type == "null" || !response_type then # No result
    returnType = ""
    returnStatement = "_ = try self.sendRequest(method: \"#{rpc_method}\", args: args)"
  elsif response_type.kind_of?(Hash) # Array result
    raise "Unsupported type: #{response_type["type"]}" if response_type["type"] != "array"
    item_cname = model_name(response_type["items"])
    returnType = " -> [#{item_cname}]"
    returnStatement = json_return_statement_for_array(rpc_method, item_cname)
  else # Dictionary
    cname = name_for_response_type(response_type)
    returnType = " -> #{cname}"

    #returnType += "?" if optional
    returnStatement = json_return_statement(rpc_method, cname, response_type)
  end

  args_str = dict_params.length > 0 ? "[" + dict_params.join(", ") + "]" : "[String: Any]()"

  impl << <<-EOS
  #{@annotation}public func #{dc_method}(#{method_params.join(", ")}) throws#{returnType} {
    let args: [String: Any] = #{args_str}
    #{returnStatement}
  }
EOS
end

# @options :lower
def idiomize_name(name, options=:upper)
  name = name.camelize(options)
  name = name.gsub('Ui', 'UI')
  name = name.gsub('Gui', 'GUI')
  name = name.gsub('Cli', 'CLI')
  name
end

@records = {}
@requests = {}

paths.each do |path|
  file = File.read(path)
  h = JSON.parse(file)

  protocol = h["protocol"]
  namespace = h["namespace"]
  #puts "\nProtocol: #{protocol}"
  name = idiomize_name(protocol)

  @records[name] ||= []
  @requests[name] ||= []

  h["types"].each do |type|
    if (@defined_types.include?(type["name"]))
      #puts "Skipping: #{type["name"]}. Already defined."
      next
    end
    @defined_types << type["name"]
    #puts "Type: #{type["name"]}"

    if type["type"] == "enum"
      enum_name = type["name"]
      @enums << enum_name
      enum_name_swift = "#{model_name(enum_name)}"
      @records[name] << "#{@annotation}public enum #{enum_name_swift}: Int {"
      type["symbols"].each do |symbol|
        sym, _, sym_val = symbol.rpartition('_')

        raise "Enums must specify value: #{enum_name} #{symbol}" if sym.length == 0
        raise "Enums must specify an integer value: #{enum_name} #{symbol}" if not /\A\d+\z/.match(sym_val)

        case_name = idiomize_name(sym.downcase, :lower)
        # Self is not a valid enum name
        case_name = "selfValue" if case_name == "self"

        @records[name] << "\tcase #{case_name} = #{sym_val}"
      end
      @records[name] << "}\n"
    elsif type["type"] == "fixed"
      @records[name] << "public typealias #{type["name"]} = [UInt8] // Size: #{type["size"]}"
      @aliases[type["name"]] = "bytes"
    elsif type["type"] == "record" and type["typedef"]
      @records[name] << "public typealias #{type["name"]} = #{model_name(type["typedef"])}"
      @aliases[type["name"]] = type["typedef"]
    elsif type["type"] == "record"
      cname = model_name(type["name"])
      @records[name] << "\n#{@annotation}public class #{cname}#{@model_subclass} {\n"
      params_str = []
      json_init_str = []
      fnames = []
      type["fields"].each do |field|
        fname = field["name"]
        ftype = field["type"]
        # Alias temp
        fname = "isInternal" if fname == "internal"
        fname = "isPrivate" if fname == "private"
        fname = "kid" if fname == "KID"
        fname = validate_name(fname, ftype, protocol)

        fnames << fname
        if ftype.kind_of?(Hash)
          subtype = ftype
          if subtype["type"] == "array"
            @records[name] << var(fname, "[#{model_name(subtype["items"])}]", false, protocol)
          elsif subtype["type"] == "map"
            # Key type is always String according to AVDL spec
            values_type = model_name(subtype["values"])
            @records[name] << var(fname, "[String: #{values_type}]", false, protocol)
          else
            puts "Unhandled subtype: #{subtype}"
          end
        else
          @records[name] << var(fname, swift_for_type(ftype), false, protocol)
        end

        params_str << "#{fname}: #{swift_for_type(ftype)}"
        json_init_str << json_init(fname, ftype)
      end

      init_selfs = fnames.collect { |f| "self.#{f} = #{f}" }
      @records[name] << <<-EOS

  #{@annotation}public init(#{params_str.join(", ")}) {
    #{init_selfs.join("\n\t\t")}
  }

  public class func fromJSON(_ json: JSON) -> #{cname} {
    return #{cname}(#{json_init_str.join(", ")})
  }

  public class func fromJSONArray(_ json: [JSON]) -> [#{cname}] {
    return json.map { fromJSON($0) }
  }

}

EOS
    else
      puts "Undefined type: #{type["type"]}"
    end
  end

  @requests[name] << "#{@annotation}public class #{name}Request: Request {\n"

  h["messages"].each do |method, mparam|
    request_params = mparam["request"].dup
    response_type = mparam["response"]

    if mparam["doc"] then
      @requests[name] << "/*!"
      @requests[name] << " " + mparam["doc"].gsub(/[\t ]+/, ' ')
      @requests[name] << " */"
    end

    add_methods(@requests[name], namespace, protocol, method, request_params, response_type)
  end
  @requests[name] << "}\n"

end


def header(filename) <<-EOS
//
// This file is autogenerated
//

//
//  #{filename}
//  Keybase
//  Copyright © 2017 Keybase. All rights reserved.
//

import Foundation
import SwiftyJSON
EOS
end

if !out_dir.nil? then
  @requests.each do |name, lines|
    next if lines.length == 0
    filename = "#{name}Request.swift"
    File.open("#{out_dir}/#{filename}", "w") do |f|
      f.write(header(filename))
      f.write("\n\n\n//\n")
      f.write("// #{name}\n")
      f.write("//\n\n")
      f.write(lines.join("\n"))
    end
  end

  @records.each do |name, lines|
    next if lines.length == 0
    filename = "#{name}.swift"
    File.open("#{out_dir}/#{filename}", "w") do |f|
      f.write(header(filename))
      f.write("\n\n\n//\n")
      f.write("// #{name}\n")
      f.write("//\n\n")
      f.write(lines.join("\n"))
    end
  end
end
