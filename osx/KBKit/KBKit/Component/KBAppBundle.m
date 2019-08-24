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

- (NSError *)_moveFromSource:(NSString *)source destination:(NSString *)destination {
  NSError *error = nil;
  if ([NSFileManager.defaultManager fileExistsAtPath:destination isDirectory:NULL] && ![NSFileManager.defaultManager removeItemAtPath:destination error:&error]) {
    return error;
  }
  if (![NSFileManager.defaultManager moveItemAtPath:source toPath:destination error:&error]) {
    return error;
  }
  return nil;
}

- (void)validate:(NSString *)sourcePath completion:(KBCompletion)completion {
  // Check bundle security/requirement (for source path)
  CFURLRef fileRef = CFURLCreateFromFileSystemRepresentation(kCFAllocatorDefault, (const UInt8 *)[sourcePath UTF8String], [sourcePath length], YES);
  SecStaticCodeRef staticCodeRef = NULL;
  if (SecStaticCodeCreateWithPath(fileRef, kSecCSDefaultFlags, &staticCodeRef) != errSecSuccess) {
    completion(KBMakeError(-1, @"Failed to validate bundle signature: Create code"));
    return;
  }


  /**
    The app must satisfy the following codesigning requirements:

    1. The root certificate must be an "apple generic" certificate
    2. The leaf of the Mac App Store certificate must have the field "field.1.2.840.113635.100.6.1.9", or
    3. Certificate 1 corresponds to the "Developer ID Certification Authority" certificate and must have the field "1.2.840.113635.100.6.2.6"
    4. The leaf of "Developer ID Application: Keybase, Inc. (99229SGT5K)" certificate must have the field "field.1.2.840.113635.100.6.1.13"
    5. The leaf must have subject OU of "99229SGT5K"
    6. The identifier be "keybase.Keybase" or "keybase.Electron"

    This requirement is the standard one issued by Xcode when signing with developer ID certificate.

    You can view designated requirements for an app by running: codesign -d -r- /Applications/Keybase.app

    References:
      https://red-sweater.com/blog/2390/developer-id-gotcha
      https://opensource.apple.com/source/libsecurity_codesigning/libsecurity_codesigning-55032/lib/syspolicy.sql
   */
  NSString *requirementText = @"anchor apple generic and (certificate leaf[field.1.2.840.113635.100.6.1.9] /* exists */ or certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = \"99229SGT5K\") and (identifier \"keybase.Keybase\" or identifier \"keybase.Electron\")";

  SecRequirementRef requirementRef = NULL;
  if (SecRequirementCreateWithString((__bridge CFStringRef)requirementText, kSecCSDefaultFlags, &requirementRef) != errSecSuccess) {
    completion(KBMakeError(-1, @"Failed to validate bundle signature: Create a requirement"));
    return;
  }
  CFErrorRef err;
  if (SecStaticCodeCheckValidityWithErrors((SecCodeRef)staticCodeRef, (kSecCSDefaultFlags | kSecCSStrictValidate | kSecCSCheckNestedCode | kSecCSCheckAllArchitectures | kSecCSEnforceRevocationChecks), requirementRef, &err) != errSecSuccess) {
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
    completion(KBMakeError(-1, [NSString stringWithFormat:@"Invalid source path: %@", sourcePath]));
    return;
  }

  NSString *destinationPath = self.config.appPath;
  if (!destinationPath) {
    completion(KBMakeError(-1, @"Invalid destination path"));
    return;
  }

  DDLogInfo(@"Installing %@ -> %@", sourcePath, destinationPath);
  DDLogInfo(@"Checking security requirements");
  [self validate:sourcePath completion:^(NSError *error) {
    if (error) {
      completion(error);
      return;
    }
    NSString *sourceContents = [NSString stringWithFormat:@"%@/%@", sourcePath, @"Contents"];
    NSString *destContents = [NSString stringWithFormat:@"%@/%@", destinationPath, @"Contents"];
    DDLogInfo(@"Copying app Contents bundle %@ to %@", sourceContents, destContents);
    error = [self _moveFromSource:sourceContents destination:destContents];
    if (error) {
      completion(error);
      return;
    }

    // Re-verify destination
    DDLogInfo(@"Checking destination");
    [self validate:destinationPath completion:completion];
  }];
}

- (NSError *) uninstallViaMove:(NSString *)path {

  NSError *ret = nil;
  NSString *contents = [NSString stringWithFormat:@"%@/%@", path, @"Contents"];

  // Create a temporary directory to move Contents/ to
  NSURL *directoryURL = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:[[NSProcessInfo processInfo] globallyUniqueString]] isDirectory:YES];
  NSMutableDictionary *attributes = [NSMutableDictionary dictionary];
  attributes[NSFilePosixPermissions] = [NSNumber numberWithShort:0700];
  if (![[NSFileManager defaultManager] createDirectoryAtURL:directoryURL withIntermediateDirectories:YES attributes:attributes error:&ret]) {
    DDLogDebug(@"Failed to create temporary directory %@", directoryURL);
    return ret;
  }
  NSString *destPath = [NSString stringWithFormat:@"%@/%@", [directoryURL path], @"Contents"];
  DDLogDebug(@"Moving %@ -> %@", contents, destPath);
  if (![NSFileManager.defaultManager moveItemAtPath:contents toPath:destPath error:&ret]) {
    DDLogDebug(@"Failed to move app contents: %@", ret);
    return ret;
  }
  DDLogDebug(@"Moved %@ -> %@ as an uninstall", contents, destPath);
  return nil;
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
  if (![self.helperTool exists]) {
    DDLogDebug(@"Cannot uninstall app bundle via helper, since it was never installed; we'll uninstall Contents via move");
    NSError *err = [self uninstallViaMove:path];
    completion(err);
    return;
  }
  NSDictionary *params = @{};
  [self.helperTool.helper sendRequest:@"uninstallAppBundle" params:@[params] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

@end
