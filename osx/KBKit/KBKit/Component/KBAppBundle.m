//
//  KBAppBundle.m
//  KBKit
//
//  Created by Gabriel on 2/1/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import "KBAppBundle.h"

@interface KBAppBundle ()
@property KBHelperTool *helperTool;
@end

@implementation KBAppBundle

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool {
  if ((self = [self initWithConfig:config name:@"App" info:@"App bundle" image:nil])) {
    _helperTool = helperTool;
  }
  return self;
}

- (void)validate:(NSString *)sourcePath completion:(KBCompletion)completion {
  // Check bundle security/requirement (for source path)
  CFURLRef fileRef = CFURLCreateFromFileSystemRepresentation(kCFAllocatorDefault, [sourcePath UTF8String], [sourcePath length], YES);
  SecStaticCodeRef staticCodeRef = NULL;
  if (SecStaticCodeCreateWithPath(fileRef, kSecCSDefaultFlags, &staticCodeRef) != errSecSuccess) {
    completion(KBMakeError(-1, @"Failed to validate bundle signature: Create code"));
    return;
  }

  NSString *requirementText = @"anchor apple generic and (certificate leaf[field.1.2.840.113635.100.6.1.9] /* exists */ or certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = \"99229SGT5K\") and (identifier \"keybase.Keybase\" or identifier \"keybase.Electron\")";

  SecRequirementRef requirementRef = NULL;
  if (SecRequirementCreateWithString((__bridge CFStringRef)requirementText, kSecCSDefaultFlags, &requirementRef) != errSecSuccess) {
    completion(KBMakeError(-1, @"Failed to validate bundle signature: Create a requirement"));
    return;
  }
  CFErrorRef err;
  if (SecStaticCodeCheckValidityWithErrors((SecCodeRef)staticCodeRef, kSecCSDefaultFlags, requirementRef, &err) != errSecSuccess) {
    completion(KBMakeError(-1, @"Failed to validate bundle signature: Check"));
    return;
  }
  if (staticCodeRef) CFRelease(staticCodeRef);
  if (requirementRef) CFRelease(requirementRef);
  completion(nil);
}

- (void)install:(KBCompletion)completion {
  NSString *sourcePath = self.config.sourcePath;
  if (!sourcePath || ![NSFileManager.defaultManager fileExistsAtPath:sourcePath]) {
    completion(KBMakeError(-1, @"Invalid source path"));
    return;
  }

  NSString *destinationPath = self.config.appPath;
  if (!destinationPath) {
    completion(KBMakeError(-1, @"Invalid destination path"));
    return;
  }

  DDLogInfo(@"Checking security requirements");
  [self validate:sourcePath completion:^(NSError *error) {
    if (error) {
      completion(error);
      return;
    }

    DDLogInfo(@"Copying app bundle %@ to %@", sourcePath, destinationPath);
    NSDictionary *params = @{@"source": sourcePath, @"destination": destinationPath};
    [self.helperTool.helper sendRequest:@"move" params:@[params] completion:^(NSError *error, id value) {
      completion(error);
    }];
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSString *path = self.config.appPath;
  // Only remove from approved locations
  if (![path isEqualToString:@"/Applications/Keybase.app"]) {
    completion(KBMakeError(-1, @"Not approved to uninstall: %@", path));
    return;
  }
  if (![NSFileManager.defaultManager fileExistsAtPath:path]) {
    DDLogInfo(@"No app to uninstall");
    completion(nil);
    return;
  }
  NSDictionary *params = @{@"source": path, @"destination": @"/tmp/Keybase.app"};
  [self.helperTool.helper sendRequest:@"move" params:@[params] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

@end
