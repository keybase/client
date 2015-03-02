require "json"
require "active_support/inflector"

script_path = File.expand_path(File.dirname(__FILE__))

paths = Dir["#{script_path}/../json/*.json"]

defined_types = []
enums = []

def classname(n)
  "KBR#{n}"
end

def objc_for_type(type, enums)
  type = type["type"] if type.kind_of?(Hash) # Subtype (for arrays)
  type = type.find { |t| t != "null" } if type.kind_of?(Array) # Union

  case type
  when "string" then "NSString *"
  when "int" then "NSInteger "
  when "array" then "NSArray *"
  when "boolean" then "BOOL "
  when "bytes" then "NSData *"
  when "null" then "void"
  else
    if type.start_with?("void")
      type
    elsif enums.include?(type)
      classname(type) + " "
    else
      classname("#{type} *")
    end
  end
end

def is_native_type(type)
  is_primitive_type(type) || ["string", "array", "bytes"].include?(type)
end

def is_primitive_type(type)
  type = type.find { |t| t != "null" } if type.kind_of?(Array) # Union
  ["int", "boolean", "null"].include?(type)
end

def default_name_for_type(type)
  type = type["type"] if type.kind_of?(Hash) # Subtype (for arrays)

  case type
  when "string" then "str"
  when "int" then "n"
  when "array" then "items"
  when "boolean" then "b"
  when "binary" then "data"
  when "null" then "void"
  else type.camelize(:lower)
  end
end

def value_for_type(type, name, enums)
  type = type.find { |t| t != "null" } if type.kind_of?(Array) # Union
  varname = "params[0][@\"#{name}\"]"

  if type.kind_of?(Hash) # (for arrays)
    array_class = type["items"]
    return "[MTLJSONAdapter modelsOfClass:#{classname(array_class)}.class fromJSONArray:#{varname} error:nil]"
  end

  if enums.include?(type)
    return "[#{varname} integerValue]"
  end

  case type
  when "int" then "[#{varname} integerValue]"
  when "boolean" then "[#{varname} boolValue]"

  when "string" then varname
  when "array" then varname
  when "bytes" then varname
  else
    "[MTLJSONAdapter modelOfClass:#{classname(type)}.class fromJSONDictionary:#{varname} error:nil]"
  end
end

header = []
header << "#import \"KBRObject.h\""
header << "#import \"KBRRequest.h\""
header << "#import \"KBRRequestParams.h\""
header << ""
impl = []
impl << "#import \"KBRPC.h\"\n"

header_handlers = []
impl_handlers = []

paths.each do |path|
  file = File.read(path)
  h = JSON.parse(file)

  protocol = h["protocol"]
  namespace = h["namespace"]

  h["types"].each do |type|
    next if (defined_types.include?(type["name"]))
    defined_types << type["name"]

    if type["type"] == "enum"
      enums << type["name"]
      enum_name = "#{classname(type["name"])}"
      header << "typedef NS_ENUM (NSInteger, #{enum_name}) {"
      type["symbols"].each do |sym|
        header << "\t#{enum_name}#{sym.capitalize.camelize},"
      end
      header << "};"
    end


    if type["type"] == "fixed"
      header << "@interface #{classname(type["name"])} : NSData"
      header << "@end\n"
      impl << "@implementation #{classname(type["name"])}"
      impl << "@end\n"
    end

    transformers = []
    if type["type"] == "record"
      header << "@interface #{classname(type["name"])} : KBRObject"
      type["fields"].each do |field|
        if field["type"].kind_of?(Hash)
          subtype = field["type"]
          if subtype["type"] == "array"

            if is_native_type(subtype["items"])
              header << "@property NSArray *#{field["name"]}; /*of #{subtype["items"]}*/"
            else
              header << "@property NSArray *#{field["name"]}; /*of #{classname(subtype["items"])}*/"
              transformers << "+ (NSValueTransformer *)#{field["name"]}JSONTransformer { return [NSValueTransformer mtl_JSONArrayTransformerWithModelClass:#{classname(subtype["items"])}.class]; }"
            end
          end
        else
          header << "@property #{objc_for_type(field["type"], enums)}#{field["name"]};"
        end
      end
      header << "@end\n"
      impl << "@implementation #{classname(type["name"])}"
      impl += transformers if transformers
      impl << "@end\n"
    end
  end


  header << "@interface #{classname(protocol.camelize)}Request : KBRRequest"
  impl << "@implementation #{classname(protocol.camelize)}Request\n"

  h["messages"].each do |method, mparam|
    request_params = mparam["request"].dup
    response_type = mparam["response"]

    request_params_items = request_params.map do |p|
      if is_primitive_type(p["type"]) || enums.include?(p["type"])
        "@\"#{p["name"]}\": @(#{p["name"]})"
      else
        "@\"#{p["name"]}\": KBRValue(#{p["name"]})"
      end
    end

    response_completion = if response_type == "null" then
      "void (^)(NSError *error)"
    else
      "void (^)(NSError *error, #{objc_for_type(response_type, enums)} #{default_name_for_type(response_type)})"
    end

    request_params << { "name" => "completion", "type" => response_completion }

    params_str = request_params.each_with_index.collect do |param, index|
      name = param["name"]
      name = "With#{name.camelize}" if index == 0
      name = "" if request_params.length == 1

      "#{name}:(#{objc_for_type(param["type"], enums)})#{param["name"]}"
    end

    rpc_method = "#{namespace}.#{protocol}.#{method}"
    dc_method = method.camelize(:lower)
    objc_method = "- (void)#{dc_method}#{params_str.join(" ")}"

    header << "#{objc_method};\n"
    impl << "#{objc_method} {"

    callback = if response_type == "null" then
      "completion(error);"
    elsif is_native_type(response_type)
      "completion(error, 0);" # TODO
    elsif response_type.kind_of?(Hash) # Subtype (for arrays)
      item_type = response_type["type"]
      # TODO
      ""
    else
      clsname = classname(response_type)
      "if (error) {
        completion(error, nil);
        return;
      }
      #{clsname} *result = [MTLJSONAdapter modelOfClass:#{clsname}.class fromJSONDictionary:dict error:&error];
      completion(error, result);"
    end

    impl << "  NSArray *params = @[@{#{request_params_items.join(", ")}}];
  [self.client sendRequestWithMethod:@\"#{rpc_method}\" params:params completion:^(NSError *error, NSDictionary *dict) {
    #{callback}
  }];"

    impl << "}\n"


    # Request handlers
    if mparam["request"].length > 0
      header_handlers << "@interface KBR#{method.camelize}RequestParams : KBRRequestParams"
      mparam["request"].each do |param|
        header_handlers << "@property #{objc_for_type(param["type"], enums)}#{param["name"]};"
      end
      header_handlers << "@end"

      impl_handlers << "@implementation KBR#{method.camelize}RequestParams\n"

      impl_handlers << "- (instancetype)initWithParams:(NSArray *)params {"
      impl_handlers << "  if ((self = [super initWithParams:params])) {"
      mparam["request"].each do |param|
        value = value_for_type(param["type"], param["name"], enums)
        impl_handlers << "    self.#{param["name"]} = #{value};"
      end
      impl_handlers << "  }"
      impl_handlers << "  return self;"
      impl_handlers << "}\n"
      impl_handlers << "@end\n"
    end

  end
  header << "@end\n"
  impl << "@end\n"

end

File.open("#{script_path}/../objc/KBRPC.h", "w") { |file|
  file.write(header.join("\n"))
  file.write(header_handlers.join("\n"))
}
File.open("#{script_path}/../objc/KBRPC.m", "w") { |file|
  file.write(impl.join("\n"))
  file.write(impl_handlers.join("\n"))
}

