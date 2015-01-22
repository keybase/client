require "json"
require "active_support/inflector"

script_path = File.expand_path(File.dirname(__FILE__))

paths = Dir["#{script_path}/../json/*.json"]

defined_types = []
enums = []

objc_prefix = "KBR"

def objc_for_type(type, enums, objc_prefix)
  if type.kind_of?(Hash)
    type = type["type"]
  end

  # Union
  if type.kind_of?(Array)
    type = type.find { |t| t != "null" }
  end

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
      "#{objc_prefix}#{type} "
    else
      "#{objc_prefix}#{type} *"
    end
  end
end

def is_native_type(type)
  is_primitive_type(type) || ["string", "array"].include?(type)
end

def is_primitive_type(type)
  if type.kind_of?(Array) # Union
    type = type.find { |t| t != "null" }
  end

  ["int", "boolean", "null"].include?(type)
end

def default_name_for_type(type)
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

header = []
header << "#import \"KBRObject.h\""
header << "#import \"KBRRequest.h\""
header << ""
impl = []
impl << "#import \"KBRPC.h\"\n"

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
      enum_name = "#{objc_prefix}#{type["name"]}"
      header << "typedef NS_ENUM (NSInteger, #{enum_name}) {"
      type["symbols"].each do |sym|
        header << "\t#{enum_name}#{sym.capitalize}, "
      end
      header << "};"
    end


    if type["type"] == "fixed"
      header << "@interface #{objc_prefix}#{type["name"]} : NSData"
      header << "@end\n"
      impl << "@implementation #{objc_prefix}#{type["name"]}"
      impl << "@end\n"
    end

    if type["type"] == "record"
      header << "@interface #{objc_prefix}#{type["name"]} : KBRObject"
      type["fields"].each do |field|
        header << "@property #{objc_for_type(field["type"], enums, objc_prefix)}#{field["name"]};"
      end
      header << "@end\n"
      impl << "@implementation #{objc_prefix}#{type["name"]}"
      impl << "@end\n"
    end
  end


  header << "@interface #{objc_prefix}#{protocol.camelize}Request : KBRRequest"
  impl << "@implementation #{objc_prefix}#{protocol.camelize}Request"

  h["messages"].each do |method, mparam|
    request_params = mparam["request"]
    response_type = mparam["response"]

    request_params_items = request_params.map do |p|
      if is_primitive_type(p["type"]) || enums.include?(p["type"])
        "@\"#{p["name"]}\": @(#{p["name"]})"
      else
        "@\"#{p["name"]}\": #{objc_prefix}Value(#{p["name"]})"
      end
    end

    response_completion = if response_type == "null" then
      "void (^)(NSError *error)"
    else
      "void (^)(NSError *error, #{objc_for_type(response_type, enums, objc_prefix)} #{default_name_for_type(response_type)})"
    end

    request_params << { "name" => "completion", "type" => response_completion }

    params_str = request_params.each_with_index.collect do |param, index|
      name = param["name"]
      name = "With#{name.camelize}" if index == 0
      name = "" if request_params.length == 1

      "#{name}:(#{objc_for_type(param["type"], enums, objc_prefix)})#{param["name"]}"
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
    else
      classname = "#{objc_prefix}#{response_type}"
      "if (error) {
        completion(error, nil);
        return;
      }
      #{classname} *result = [MTLJSONAdapter modelOfClass:#{classname}.class fromJSONDictionary:dict error:&error];
      completion(error, result);"
    end

    impl << "
  NSArray *params = @[@{#{request_params_items.join(", ")}}];
  [self.client sendRequestWithMethod:@\"#{rpc_method}\" params:params completion:^(NSError *error, NSDictionary *dict) {
    #{callback}
  }];"

    impl << "}\n"
  end
  header << "@end\n"
  impl << "@end\n"

end

File.open("#{script_path}/../objc/KBRPC.h", "w") { |file| file.write(header.join("\n")) }
File.open("#{script_path}/../objc/KBRPC.m", "w") { |file| file.write(impl.join("\n")) }

