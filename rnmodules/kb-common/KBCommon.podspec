Pod::Spec.new do |s|
  s.name         = 'KBCommon'
  s.summary      = 'KBCommon'
  s.homepage     = 'https://github.com/keybase/client'
  s.license      = 'BSD-3'
  s.authors      = 'keybase (https://github.com/keybase/client)'
  s.version      = '1.0.0'
  s.source           = { :git => 'https://github.com/keybase/client.git' }
  s.source_files = 'src/**/*.{h,m,swift}'
  s.public_header_files = 'src/**/*.h'
  s.requires_arc = true
  s.module_name  = 'KBCommon'
  s.swift_version = '5.0'
  s.pod_target_xcconfig = { 
    'SWIFT_INSTALL_OBJC_HEADER' => 'YES',
    'ENABLE_ENHANCED_SECURITY[sdk=iphoneos*]' => 'YES',
    'ENABLE_POINTER_AUTHENTICATION[sdk=iphoneos*]' => 'YES'
  }
end
