Pod::Spec.new do |s|

  s.name         = "KBKit"
  s.version      = "0.1.6"
  s.summary      = "KBKit"
  s.homepage     = "https://github.com/gabriel/specs"
  s.license      = "MIT"
  s.authors      = {"Gabriel Handford" => "gabrielh@gmail.com"}
  s.source       = {:git => "https://github.com/gabriel/specs.git"}

  s.requires_arc = true

  s.dependency "YOLayout"
  s.dependency "GHKit"
  s.dependency "ObjectiveSugar"
  s.dependency "CocoaLumberjack"
  s.dependency "AFNetworking", "~> 2.0"
  s.dependency "GHKeychain"
  s.dependency "Mantle"
  s.dependency "MPMessagePack"
  s.dependency "GHODictionary"
  #s.dependency "MASPreferences"
  s.dependency "MDPSplitView"
  s.dependency "Tikppa"

  s.platform = :osx, "10.10"
  s.osx.source_files = "KBKit/**/*.{h,m}"

end
