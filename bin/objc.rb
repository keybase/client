require "json"
require "active_support/inflector"

script_path = File.expand_path(File.dirname(__FILE__))

paths = Dir["#{script_path}/../json/*.json"]

defined_types = []
enums = []

def objc_for_type(type, enums)
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
      "KB#{type} "
    else
      "KB#{type} *"
    end
  end
end

def is_native_type(type)
  ["string", "int", "array", "boolean", "null"].include?(type)
end

def is_primitive_type(type)
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
  else type[0, 1].downcase + type[1..-1] # uncapitalize
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

  h["types"].each do |type|
    next if (defined_types.include?(type["name"]))
    defined_types << type["name"]

    if type["type"] == "enum"
      enums << type["name"]
      header << "typedef NS_ENUM (NSInteger, KB#{type["name"]}) {"
      type["symbols"].each do |sym|
        header << "\tKB#{sym.capitalize}, "
      end
      header << "};"
    end

    if type["type"] == "fixed"
      type["type"] = "record"
      type["fields"] = [{"name" => "data", "type" => "bytes"}]
    end

    if type["type"] == "record"
      header << "@interface KB#{type["name"]} : KBRObject"
      type["fields"].each do |field|
        header << "@property #{objc_for_type(field["type"], enums)}#{field["name"]};"
      end
      header << "@end\n"
      impl << "@implementation KB#{type["name"]}"
      names = type["fields"].map { |p| "@\"#{p["name"]}\": @\"#{p["name"]}\"" }
      impl << "+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{#{names.join(", ")} }; }"
      impl << "@end\n"
    end
  end


  header << "@interface KBR#{h["protocol"].capitalize} : KBRRequest"
  impl << "@implementation KBR#{h["protocol"].capitalize}"

  h["messages"].each do |method, mparam|
    request_params = mparam["request"]
    response_type = mparam["response"]

    request_dict = request_params.map do |p|
      if is_primitive_type(p["type"])
        "@\"#{p["name"]}\": @(#{p["name"]})"
      else
        "@\"#{p["name"]}\": #{p["name"]}"
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
      name = "With#{name.capitalize}" if index == 0
      name = "" if request_params.length == 1

      "#{name}:(#{objc_for_type(param["type"], enums)})#{param["name"]}"
    end

    # Uncapitalize
    method = method[0, 1].downcase + method[1..-1]

    objc_method = "- (void)#{method}#{params_str.join(" ")}"

    header << "#{objc_method};\n"
    impl << "#{objc_method} {"

    callback = if response_type == "null" then
      "completion(error);"
    else
      classname = "KB#{response_type}"
      "#{classname} *result = [MTLJSONAdapter modelOfClass:#{classname}.class fromJSONDictionary:dict error:&error];
    completion(error, result);"
    end

    impl << "
  NSDictionary *params = @{#{request_dict.join(", ")}};
  [self.client sendRequestWithMethod:@\"#{method}\" params:params completion:^(NSError *error, NSDictionary *dict) {
    #{callback}
  }];"

    impl << "}\n"
  end
  header << "@end\n"
  impl << "@end\n"

end

File.open("#{script_path}/../objc/KBRPC.h", "w") { |file| file.write(header.join("\n")) }
File.open("#{script_path}/../objc/KBRPC.m", "w") { |file| file.write(impl.join("\n")) }

