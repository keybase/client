require "json"

begin
  require "active_support/inflector"
rescue LoadError
  puts "You need to install active support: gem install activesupport"
  exit 1
end

script_path = File.expand_path(File.dirname(__FILE__))

paths = Dir["#{script_path}/../json/*.json"]

defined_types = []
enums = []
aliases = {}

def classname(type, aliases)
  type = aliases[type] if aliases[type]

  raise "Unsupported classname for Array" if type == "array"

  case type
  when "int" then "Int32"
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

def swift_for_type(type, enums, aliases, space)
  subtype = nil
  if type.kind_of?(Hash) # Subtype (for array, map)
    if type["type"] == "array" then
      subtype = type["items"]
      name = "[#{classname(subtype, aliases)}]"
    elsif type["type"] == "map" then
      subtype = type["values"]
      name = "Dictionary<String, #{classname(subtype, aliases)}>"
    else
      raise "Unsupported subtype"
    end
  else
    type = type.find { |t| t != "null" } if type.kind_of?(Array) # Union
    type = aliases[type] if aliases[type]
    name = classname(type, aliases)
  end
  name = "#{name} " if space
  name
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

def json_cast(type, enums, aliases)
  type = type["type"] if type.kind_of?(Hash) # Subtype (for array, map)
  type = type.find { |t| t != "null" } if type.kind_of?(Array) # Union
  type = aliases[type] if aliases[type]

  return ".int!" if enums.include?(type)

  case type
  when "int" then ".int32"
  when "long" then ".int64"
  when "float" then ".float"
  when "double" then ".double"
  when "string" then ".string"
  when "boolean" then ".bool"
  when "array" then ".array"
  when "map" then ".dictionary"
  when "bytes" then " as? NSData"
  else
    nil
  end
end

def json_init(name, type, enums, aliases)
  type = type.find { |t| t != "null" } if type.kind_of?(Array) # Union
  type = aliases[type] if aliases[type]

  if type == "bytes"
    return "#{name}: NSData()/*TODO: Fixme*/"
  end

  cast = json_cast(type, enums, aliases)
  value = if cast
    "json[\"#{name}\"]#{cast}"
  else
    "#{type}.fromJSON(json[\"#{name}\"])"
  end

  if enums.include?(type)
    value = "#{type}(rawValue: #{value})"
  end

  if type.kind_of?(Hash) && type["type"] == "array"
    value = "#{classname(type["items"], aliases)}.fromJSONArray(#{value})"
  end

  return "#{name}: #{value}"
end

def empty_value_for_type(type)
  type = type["type"] if type.kind_of?(Hash) # Subtype (for array, map)

  case type
  when "int" then "0"
  when "long" then "0"
  when "float" then "0"
  when "double" then "0"
  when "string" then "\"\""
  when "array" then "[]"
  when "map" then "[]"
  when "bytes" then "NSData()"
  when "boolean" then "false"
  else
    "nil" #"#{type}()"
  end
end

def var(name, type)
  return "\tpublic let #{name}: #{type}?"
end


def add_methods(impl, namespace, protocol, response_type, method, params_str, enums, aliases)
  rpc_method = "#{namespace}.#{protocol}.#{method}"
  dc_method = method.camelize(:lower)

  if response_type == "null" then
    return_str = " "
  else
    return_str = " -> #{swift_for_type(response_type, enums, aliases, false)}? "
  end

  swift_method = "func #{dc_method}(#{params_str.join(", ")})#{return_str}"

  impl << "\t#{swift_method}{"


  #impl << "\tDictionary rparams = [#{request_params_items.join(", ")}]\n"
  #impl << self.client.sendRequestWithMethod(\"#{rpc_method}\" params:rparams sessionId:self.sessionId)"

  if response_type != "null"
    impl << "\t\treturn nil" #{empty_value_for_type(response_type)}
  end
  impl << "\t}\n"
end

impl = []
impl_records = []

paths.each do |path|
  file = File.read(path)
  h = JSON.parse(file)

  protocol = h["protocol"]
  namespace = h["namespace"]
  #puts "\nProtocol: #{protocol}"

  h["types"].each do |type|
    if (defined_types.include?(type["name"]))
      #puts "Skipping: #{type["name"]}. Already defined."
      next
    end
    defined_types << type["name"]
    #puts "Type: #{type["name"]}"

    if type["type"] == "enum"
      enum_name = type["name"]
      enums << enum_name
      enum_name_swift = "#{classname(enum_name, aliases)}"
      impl_records << "public enum #{enum_name_swift}: Int {"
      type["symbols"].each do |symbol|
        sym, _, sym_val = symbol.rpartition('_')

        raise "Enums must specify value: #{enum_name} #{symbol}" if sym.length == 0
        raise "Enums must specify an integer value: #{enum_name} #{symbol}" if not /\A\d+\z/.match(sym_val)

        impl_records << "\tcase #{sym.capitalize.camelize} = #{sym_val}"
      end
      impl_records << "}\n"
    elsif type["type"] == "fixed"
      impl_records << "public typealias #{type["name"]} = [UInt8] // Size: #{type["size"]}"
      aliases[type["name"]] = "bytes"
    elsif type["type"] == "record" and type["typedef"]
      impl_records << "public typealias #{type["name"]} = #{classname(type["typedef"], aliases)}"
      aliases[type["name"]] = type["typedef"]
    elsif type["type"] == "record"
      cname = classname(type["name"], aliases)
      impl_records << ""
      impl_records << "public class #{cname} {"
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
            impl_records << var(fname, "[#{classname(subtype["items"], aliases)}]")
          end
        else
          impl_records << var(fname, swift_for_type(ftype, enums, aliases, false))
        end

        params_str << "#{fname}: #{swift_for_type(ftype, enums, aliases, false)}?"
        json_init_str << json_init(fname, ftype, enums, aliases)
      end

      # Initializer
      impl_records << ""
      impl_records << "\tpublic init(#{params_str.join(", ")}) {"
      fnames.each do |name|
        impl_records << "\t\tself.#{name} = #{name}"
      end
      impl_records << "\t}"

      # From JSON
      impl_records << ""
      impl_records << "\tpublic class func fromJSON(json: JSON) -> #{cname} {"
      impl_records << "\t\treturn #{cname}(#{json_init_str.join(", ")})"
      impl_records << "\t}"

      impl_records << ""
      impl_records << "\tpublic class func fromJSONArray(json: [JSON]?) -> [#{cname}] {"
      impl_records << "\t\treturn json!.map { fromJSON($0) }"
      impl_records << "\t}"

      impl_records << "}\n"
    else
      puts "Undefined type: #{type["type"]}"
    end
  end

  impl << "class #{classname(protocol.camelize, aliases)}Request: Request {\n"

  h["messages"].each do |method, mparam|
    request_params = mparam["request"].dup
    response_type = mparam["response"]

    params_str = []
    if mparam["doc"] then
      impl << "/*!"
      impl << " " + mparam["doc"].gsub(/[\t ]+/, ' ')
      impl << " */"
    end

    # Generate with full method signature
    if request_params.length > 0
      params_str = request_params.each_with_index.collect do |param, index|
        name = param["name"]
        type = param["type"]
        validate_name(name, type, protocol)

        "#{name}: #{swift_for_type(type, enums, aliases, false)}"
      end
      add_methods(impl, namespace, protocol, response_type, method, params_str, enums, aliases)
    end

  end
  impl << "}\n"

end

path = "#{script_path}/../swift"
# path = "/Users/gabe/Projects/Keybase.framework/Keybase"

File.open("#{path}/RPC.swift", "w") { |f|
  f.write("// This file is autogenerated\n\n")
  f.write(impl.join("\n"))
}

File.open("#{path}/Models.swift", "w") { |f|
  f.write("// This file is autogenerated\n\n")
  f.write("import SwiftyJSON\n")
  f.write("\n")
  f.write(impl_records.join("\n"))
}
