require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -Wno-comma -Wno-shorten-64-to-32'
kb_cpp_flags = "-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -DMSGPACK_NO_BOOST=1"

Pod::Spec.new do |s|
  s.name         = "react-native-kb"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "11.0" }
  s.source       = { :git => "https://github.com/keybase/client/react-native-kb.git", :tag => "#{s.version}" }

  s.source_files = [
      "ios/**/*.{h,m,mm,cpp}",
      "cpp/**/*.{h,cpp}",
      "cpp/*.{h,cpp}"
  ]
  # cpp/tests is a standalone plain-clang++ test binary (see
  # rnmodules/react-native-kb/scripts/test-framing.sh), not part of the shipped module.
  s.exclude_files = "cpp/tests/**/*"

  s.dependency "KBCommon"

  # Kb.mm calls into keybasego.xcframework, which is a gitignored build artifact
  # and so never arrives with a branch. Without this, checking out a branch that
  # adds an exported func to go/bind fails the build on a missing C identifier
  # with no hint that `yarn ios:gobuild` is the fix. Runs before Kb.mm compiles
  # and no-ops (a `find -newer` probe) when the framework is already current.
  # KB_SKIP_GOBUILD=1 opts out.
  s.script_phase = {
    :name => "Build Keybasego if stale",
    # Off PODS_ROOT (shared/ios/Pods), not PODS_TARGET_SRCROOT: the pod source
    # is the synced copy under shared/node_modules, so a path relative to it
    # depends on where the copy landed.
    :script => '"$PODS_ROOT/../../react-native/gobuild-if-needed.sh" ios',
    :execution_position => :before_compile,
    # No declared outputs: the check is the point, and it is cheap. Declaring
    # the xcframework as an output would make Xcode skip the staleness probe.
    :always_out_of_date => "1"
  }

  # Use install_modules_dependencies helper to install the dependencies if React Native version >=0.71.0.
  # See https://github.com/facebook/react-native/blob/febf6b7f33fdb4904669f99d795eba4c0f95d7bf/scripts/cocoapods/new_architecture.rb#L79.
  if respond_to?(:install_modules_dependencies, true)
      s.pod_target_xcconfig    = {
          "HEADER_SEARCH_PATHS" => "\"$(PODS_ROOT)/boost\" $(PODS_ROOT)/../../node_modules/msgpack-cxx-7.0.0/include $(PODS_ROOT)/../keybasego.xcframework/ios-arm64/Keybasego.framework/Headers \"$(PODS_CONFIGURATION_BUILD_DIR)/KBCommon\"",
          "OTHER_CPLUSPLUSFLAGS" => kb_cpp_flags,
          "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
      }
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"

    # Don't install the dependencies when we run `pod install` in the old architecture.
    if ENV['RCT_NEW_ARCH_ENABLED'] == '1' then
      s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
      s.pod_target_xcconfig    = {
          "HEADER_SEARCH_PATHS" => "\"$(PODS_ROOT)/boost\" $(PODS_ROOT)/../../node_modules/msgpack-cxx-7.0.0/include $(PODS_ROOT)/../keybasego.xcframework/ios-arm64/Keybasego.framework/Headers \"$(PODS_CONFIGURATION_BUILD_DIR)/KBCommon\"",
          "OTHER_CPLUSPLUSFLAGS" => kb_cpp_flags,
          "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
      }
      s.dependency "React-Codegen"
      s.dependency "RCT-Folly"
      s.dependency "RCTRequired"
      s.dependency "RCTTypeSafety"
      s.dependency "ReactCommon/turbomodule/core"
    else
      s.pod_target_xcconfig    = {
          "HEADER_SEARCH_PATHS" => "\"$(PODS_ROOT)/boost\" $(PODS_ROOT)/../../node_modules/msgpack-cxx-7.0.0/include $(PODS_ROOT)/../keybasego.xcframework/ios-arm64/Keybasego.framework/Headers \"$(PODS_CONFIGURATION_BUILD_DIR)/KBCommon\"",
          "OTHER_CPLUSPLUSFLAGS" => kb_cpp_flags,
          "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
      }
    end
  end

end
