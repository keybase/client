require "json"

begin
  require "active_support/inflector"
rescue LoadError
  puts "You need to install active support: gem install activesupport"
  exit 1
end

script_path = File.expand_path(File.dirname(__FILE__))

paths = Dir["#{script_path}/../json/*.json"]

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
  when "long" then "Int64"
  when "float" then "Float"
  when "double" then "Double"
  when "string" then "String"
  when "bytes" then "NSData"
  when "boolean" then "Bool"
  else
    type
  end
end

def return_type(type)
  type = @aliases[type] if @aliases[type]
  raise "Unsupported type array" if type == "array"

  return "NSNumber" if @use_nsnumber && ["int", "long", "float", "double", "boolean"].include?(type)

  return model_name(type)
end

def is_objc_primitive(type)
 ["int", "long", "float", "double", "boolean"].include?(type)
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

  if name == type
    raise "Invalid name: #{name} in #{source}. In Swift the property name != type name (#{name} == #{type})."
  end

  if ["internal", "private"].include?(name)
    raise "Invalid name: #{name} in #{source}. In Swift you can't have a property named \"#{name}\"."
  end
end

def json_cast(type, optional=false)
  type = @aliases[type] if @aliases[type]
  type = type["type"] if type.kind_of?(Hash) # Subtype (for array, map)

  return ".intValue" if @enums.include?(type)

  case type
  when "int" then ".intValue"
  when "long" then ".int64Value"
  when "float" then ".floatValue"
  when "double" then ".doubleValue"
  when "boolean" then ".boolValue"
  when "string" then ".stringValue"
  when "array" then ".arrayValue"
  when "map" then ".dictionaryValue"
  when "bytes" then ".object as! NSData"
  else
    nil
  end
end

def json_return_cast(type)
  return ".numberValue" if @use_nsnumber && ["int", "long", "float", "double", "boolean"].include?(type)
  return json_cast(type)
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

def var(name, type, optional)
  return "\tpublic let #{name}: #{type}" + (optional ? "?" : "")
end

def is_any_object(type)
  true
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
    validate_name(rname, rtype, protocol)

    method_params << "#{rname}: #{swift_for_type(rtype)}"

    rtype, optional = check_type(rtype)
    if @enums.include?(rtype)
      dict_params << "\"#{rname}\": #{rname}.rawValue"
    elsif rtype == "long"
      dict_params << "\"#{rname}\": NSNumber(longLong: #{rname})"
    elsif rtype == "int"
      dict_params << "\"#{rname}\": NSNumber(integer: #{rname})"
    elsif optional
      dict_params << "\"#{rname}\": wrapNull(#{rname})"
    else
      dict_params << "\"#{rname}\": #{rname}"
    end
  end

  if response_type == "null" then # No result
    returnType = ""
    returnStatement = "try self.sendRequest(\"#{rpc_method}\", args: args)"
  elsif response_type.kind_of?(Hash) # Array result
    item_cname = model_name(response_type["items"])
    returnType = " -> [#{item_cname}]"
    returnStatement = "let response = try self.sendRequest(\"#{rpc_method}\", args: args)
    try checkNull(response)
    return #{item_cname}.fromJSONArray(JSON(response).arrayValue)"
  else # Dictionary

    if is_objc_primitive(response_type)
      cname = return_type(response_type)
    else
      cname = swift_for_type(response_type)
    end

    returnType = " -> #{cname}"
    #returnType += "?" if optional
    cast = json_return_cast(response_type)
    if cast
      returnStatement = "let response = try self.sendRequest(\"#{rpc_method}\", args: args)
    try checkNull(response)
    return JSON(response)#{cast}"
    else
      returnStatement = "let response = try self.sendRequest(\"#{rpc_method}\", args: args)
    try checkNull(response)
    return #{cname}.fromJSON(JSON(response))"
    end
  end

  args_str = dict_params.length > 0 ? "[" + dict_params.join(", ") + "]" : "[String: AnyObject]()"

  impl << <<-EOS
  #{@annotation}public func #{dc_method}(#{method_params.join(", ")}) throws#{returnType} {
    let args: [String: AnyObject] = #{args_str}
    #{returnStatement}
  }
EOS
end

@records = {}
@requests = {}

paths.each do |path|
  file = File.read(path)
  h = JSON.parse(file)

  protocol = h["protocol"]
  namespace = h["namespace"]
  #puts "\nProtocol: #{protocol}"
  name = protocol.camelize
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

        @records[name] << "\tcase #{sym.capitalize.camelize} = #{sym_val}"
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
        validate_name(fname, ftype, protocol)

        fnames << fname
        if ftype.kind_of?(Hash)
          subtype = ftype
          if subtype["type"] == "array"
            @records[name] << var(fname, "[#{model_name(subtype["items"])}]", false)
          end
        else
          @records[name] << var(fname, swift_for_type(ftype), false)
        end

        params_str << "#{fname}: #{swift_for_type(ftype)}"
        json_init_str << json_init(fname, ftype)
      end

      init_selfs = fnames.collect { |f| "self.#{f} = #{f}" }
      @records[name] << <<-EOS

  #{@annotation}public init(#{params_str.join(", ")}) {
    #{init_selfs.join("\n\t\t")}
  }

  public class func fromJSON(json: JSON) -> #{cname} {
    return #{cname}(#{json_init_str.join(", ")})
  }

  public class func fromJSONArray(json: [JSON]) -> [#{cname}] {
    return json.map { fromJSON($0) }
  }
}
EOS
    else
      puts "Undefined type: #{type["type"]}"
    end
  end

  @requests[name] << "#{@annotation}public class #{model_name(protocol.camelize)}Request: Request {\n"

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
//  Copyright © 2015 Keybase. All rights reserved.
//

import Foundation
import SwiftyJSON
EOS
end

#path = "#{script_path}/../swift"
path = "/Users/gabe/Projects/Frameworks/KeybaseSwift/KeybaseSwift"

File.open("#{path}/Requests.swift", "w") do |f|
  f.write(header("Requests.swift"))
  @requests.each do |name, lines|
    f.write("\n\n\n//\n")
    f.write("// #{name}\n")
    f.write("//\n\n")
    f.write(lines.join("\n"))
  end
end

File.open("#{path}/Models.swift", "w") do |f|
  f.write(header("Models.swift"))
  @records.each do |name, lines|
    f.write("\n\n\n//\n")
    f.write("// #{name}\n")
    f.write("//\n\n")
    f.write(lines.join("\n"))
  end
end
