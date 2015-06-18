#
#  Be sure to run `pod spec lint YOLayout.podspec` to ensure this is a
#  valid spec and to remove all comments including this before submitting the spec.
#
#  To learn more about Podspec attributes see http://docs.cocoapods.org/specification.html
#  To see working Podspecs in the CocoaPods repo see https://github.com/CocoaPods/Specs/
#

Pod::Spec.new do |s|

  s.name         = "KBAppKit"
  s.version      = "0.1.6"
  s.summary      = "AppKit UI"
  s.homepage     = "https://github.com/gabriel/KBAppKit"
  s.license      = "MIT"
  s.authors      = {"Gabriel Handford" => "gabrielh@gmail.com"}
  s.source       = {:git => "https://github.com/gabriel/KBAppKit.git", :tag => s.version.to_s}

  s.requires_arc = true

  s.dependency "YOLayout", "~> 0.2.3"
  s.dependency "GHKit"
  s.dependency "Slash"
  s.dependency "ObjectiveSugar"
  s.dependency "CocoaLumberjack"
  s.dependency "AFNetworking"

  s.osx.platform = :osx, "10.8"
  s.osx.deployment_target = "10.8"
  s.osx.source_files = "KBAppKit/*.{h,m}"

end
