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

  case type
  when "int" then "NSNumber"
  when "long" then "NSNumber"
  when "float" then "NSNumber"
  when "double" then "NSNumber"
  when "string" then "NSString"
  when "bytes" then "NSData"
  else
    "KBR#{type}"
  end
end

def objc_for_type(type, enums, aliases, space)
  type = type["type"] if type.kind_of?(Hash) # Subtype (for arrays)
  type = type.find { |t| t != "null" } if type.kind_of?(Array) # Union

  type = aliases[type] if aliases[type]

  ptr = false
  name, ptr = case type
  when "string" then ["NSString *", true]
  when "int" then ["NSInteger", false]
  when "long" then ["long", false]
  when "float" then ["float", false]
  when "double" then ["double", false]
  when "array" then ["NSArray *", true]
  when "boolean" then ["BOOL", false]
  when "bytes" then ["NSData *", true]
  when "null" then ["void", false]
  else
    if type.start_with?("void")
      [type, false]
    elsif enums.include?(type)
      [classname(type, {}), false]
    else
      [classname("#{type} *", {}), true]
    end
  end

  name = "#{name} " if space and !ptr
  name
end

def is_native_type(type)
  is_primitive_type(type) || ["string", "array", "bytes"].include?(type)
end

def is_primitive_type(type)
  type = type.find { |t| t != "null" } if type.kind_of?(Array) # Union
  ["int", "long", "float", "double", "boolean", "null"].include?(type)
end

# Deprecated
def alias_name(name)
  name
end

def validate_name(name, source)
  raise "Invalid name: #{name} in #{source}. In Objective-C you can't start a property name with \"new\"" if name.start_with?("new")

  if ["id", "self", "default"].include?(name)
    raise "Invalid name: #{name} in #{source}. In Objective-C you can't have a property named \"#{name}\"."
  end
end

def default_name_for_type(type)
  type = type["type"] if type.kind_of?(Hash) # Subtype (for arrays)

  case type
  when "string" then "str"
  when "int" then "n"
  when "long" then "l"
  when "float" then "f"
  when "double" then "d"
  when "array" then "items"
  when "boolean" then "b"
  when "binary" then "data"
  when "null" then "void"
  else type.camelize(:lower)
  end
end

def value_for_type(type, name, enums, aliases)
  type = type.find { |t| t != "null" } if type.kind_of?(Array) # Union
  varname = "params[0][@\"#{name}\"]"

  if type.kind_of?(Hash) # (for arrays)
    type_for_array = type["items"]
    type_for_array = aliases[type_for_array] if aliases[type_for_array]
    if is_native_type(type_for_array)
      return "KBRValidateArray(#{varname}, #{classname(type_for_array, aliases)}.class)"
    else
      return "[MTLJSONAdapter modelsOfClass:#{classname(type_for_array, aliases)}.class fromJSONArray:#{varname} error:nil]"
    end
  end

  if enums.include?(type)
    return "[#{varname} integerValue]"
  end

  type = aliases[type] if aliases[type]

  case type
  when "int" then "[#{varname} integerValue]"
  when "long" then "[#{varname} longValue]"
  when "float" then "[#{varname} floatValue]"
  when "double" then "[#{varname} doubleValue]"
  when "boolean" then "[#{varname} boolValue]"
  when "string" then varname
  when "array" then varname
  when "bytes" then varname
  else
    "[MTLJSONAdapter modelOfClass:#{classname(type, aliases)}.class fromJSONDictionary:#{varname} error:nil]"
  end
end

def add_methods(header, impl, namespace, protocol, response_type, method, request_params_items, params_str, aliases)
  rpc_method = "#{namespace}.#{protocol}.#{method}"
  dc_method = method.camelize(:lower)
  objc_method = "- (void)#{dc_method}#{params_str.join(" ")}"

  #puts "Method: #{objc_method}"
  header << "#{objc_method};\n"
  impl << "#{objc_method} {"

  callback = if response_type == "null" then # No result
    "completion(error);"
  elsif is_primitive_type(response_type) # Primitive type result
    "completion(error, 0);" # TODO
  elsif response_type.kind_of?(Hash) # Array result
    item_type = response_type["items"]
    item_clsname = classname(item_type, aliases)
    "if (error) {
      completion(error, nil);
      return;
    }
    NSArray *results = retval ? [MTLJSONAdapter modelsOfClass:#{item_clsname}.class fromJSONArray:retval error:&error] : nil;
    completion(error, results);"
  else # Dictionary result
    clsname = classname(response_type, aliases)
    "if (error) {
      completion(error, nil);
      return;
    }
    #{clsname} *result = retval ? [MTLJSONAdapter modelOfClass:#{clsname}.class fromJSONDictionary:retval error:&error] : nil;
    completion(error, result);"
  end

  impl << "  NSDictionary *rparams = @{#{request_params_items.join(", ")}};
  [self.client sendRequestWithMethod:@\"#{rpc_method}\" params:rparams sessionId:self.sessionId completion:^(NSError *error, id retval) {
    #{callback}
  }];"

  impl << "}\n"

  return header, impl
end

header = []
impl = []
header_rparams = []
impl_rparams = []
header_records = []
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
      enum_name_objc = "#{classname(enum_name, aliases)}"
      header_records << "typedef NS_ENUM (NSInteger, #{enum_name_objc}) {"
      type["symbols"].each do |symbol|
        sym, _, sym_val = symbol.rpartition('_')

        raise "Enums must specify value: #{enum_name} #{symbol}" if sym.length == 0
        raise "Enums must specify an integer value: #{enum_name} #{symbol}" if not /\A\d+\z/.match(sym_val)

        header_records << "\t#{enum_name_objc}#{sym.capitalize.camelize} = #{sym_val},"
      end
      header_records << "};\n"
    elsif type["type"] == "fixed"
      aliases[type["name"]] = "bytes"
    elsif type["type"] == "record" and type["typedef"]
      aliases[type["name"]] = type["typedef"]
    elsif type["type"] == "record"
      transformers = []
      header_records << "@interface #{classname(type["name"], aliases)} : KBRObject"
      type["fields"].each do |field|
        name = field["name"]
        validate_name(name, type["name"])
        if field["type"].kind_of?(Hash)
          subtype = field["type"]
          if subtype["type"] == "array"

            if is_native_type(subtype["items"])
              header_records << "@property NSArray *#{name}; /*of #{subtype["items"]}*/"
            else
              header_records << "@property NSArray *#{name}; /*of #{classname(subtype["items"], aliases)}*/"
              transformers << "+ (NSValueTransformer *)#{name}JSONTransformer { return [MTLJSONAdapter arrayTransformerWithModelClass:#{classname(subtype["items"], aliases)}.class]; }"
            end
          end
        else
          header_records << "@property #{objc_for_type(field["type"], enums, aliases, true)}#{name};"
        end
      end
      header_records << "@end\n"
      impl_records << "@implementation #{classname(type["name"], aliases)}"
      impl_records += transformers if transformers
      impl_records << "@end\n"
    else
      puts "Undefined type: #{type["type"]}"
    end
  end


  header << "@interface #{classname(protocol.camelize, aliases)}Request : KBRRequest\n"
  impl << "@implementation #{classname(protocol.camelize, aliases)}Request\n"

  h["messages"].each do |method, mparam|
    request_params = mparam["request"].dup
    response_type = mparam["response"]

    request_params.shift if request_params.length > 0 && request_params[0]["name"] == "sessionID"

    response_completion = if response_type == "null" then
      "void (^)(NSError *error)"
    else
      "void (^)(NSError *error, #{objc_for_type(response_type, enums, aliases, true)}#{default_name_for_type(response_type)})"
    end

    # Generate with params object
    request_params_items = request_params.map do |p|
      if is_primitive_type(p["type"]) || enums.include?(p["type"])
        "@\"#{p["name"]}\": @(params.#{alias_name(p["name"])})"
      else
        "@\"#{p["name"]}\": KBRValue(params.#{alias_name(p["name"])})"
      end
    end
    params_str = []
    if mparam["doc"] then
      header << "/*!"
      header << " " + mparam["doc"].gsub(/[\t ]+/, ' ')
      header << " */"
    end
    if request_params.length > 0
      params_str << ":(KBR#{method.camelize}RequestParams *)params"
      params_str << "completion:(#{objc_for_type(response_completion, enums, aliases, false)})completion"
      add_methods(header, impl, namespace, protocol, response_type, method, request_params_items, params_str, aliases)
    else
      params_str << ":(#{objc_for_type(response_completion, enums, aliases, false)})completion"
      add_methods(header, impl, namespace, protocol, response_type, method, request_params_items, params_str, aliases)
    end

    # Generate with full method signature (deprecated)
    if request_params.length > 0
      request_params_items = request_params.map do |p|
        if is_primitive_type(p["type"]) || enums.include?(p["type"])
          "@\"#{p["name"]}\": @(#{alias_name(p["name"])})"
        else
          "@\"#{p["name"]}\": KBRValue(#{alias_name(p["name"])})"
        end
      end
      request_params << {"name" => "completion", "type" => response_completion}
      params_str = request_params.each_with_index.collect do |param, index|
        name = alias_name(param["name"])
        validate_name(name, protocol)
        name = "With#{name.camelize}" if index == 0
        name = "" if request_params.length == 1

        "#{name}:(#{objc_for_type(param["type"], enums, aliases, false)})#{alias_name(param["name"])}"
      end
      add_methods(header, impl, namespace, protocol, response_type, method, request_params_items, params_str, aliases)
    end

    # Request params
    if mparam["request"].length > 0
      header_rparams << "@interface KBR#{method.camelize}RequestParams : KBRRequestParams"
      mparam["request"].each do |param|
        header_rparams << "@property #{objc_for_type(param["type"], enums, aliases, true)}#{param["name"]};"
      end
      header_rparams << "@end"

      obj_name = "KBR#{method.camelize}RequestParams"
      impl_rparams << "@implementation #{obj_name}\n"

      impl_rparams << "- (instancetype)initWithParams:(NSArray *)params {"
      impl_rparams << "  if ((self = [super initWithParams:params])) {"
      mparam["request"].each do |param|
        value = value_for_type(param["type"], param["name"], enums, aliases)
        impl_rparams << "    self.#{param["name"]} = #{value};"
      end
      impl_rparams << "  }"
      impl_rparams << "  return self;"
      impl_rparams << "}\n"

      # Default values
      impl_rparams << "+ (instancetype)params {"
      impl_rparams << "  #{obj_name} *p = [[self alloc] init];"
      impl_rparams << "  // Add default values"
      mparam["request"].each do |param|
        if param.has_key?("default") then
          impl_rparams << "  p.#{param["name"]} = #{param["default"]};"
        end
      end
      impl_rparams << "  return p;"
      impl_rparams << "}"

      impl_rparams << "@end\n"
    end

  end
  header << "@end\n"
  impl << "@end\n"

end


File.open("#{script_path}/../objc/KBRPC.h", "w") { |f|
  f.write(<<-EOS
// This file is autogenerated
#import "KBRObject.h"
#import "KBRRequest.h"
#import "KBRRequestParams.h"

EOS
)

  f.write(header_records.join("\n"))
  f.write(header_rparams.join("\n"))
  f.write(header.join("\n"))
}

File.open("#{script_path}/../objc/KBRPC.m", "w") { |f|
  f.write(<<-EOS
// This file is autogenerated
#import "KBRPC.h"

EOS
)

  f.write(impl.join("\n"))
  f.write(impl_rparams.join("\n"))
  f.write(impl_records.join("\n"))
}

