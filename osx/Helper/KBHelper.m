//
//  KBHelper.m
//  Keybase
//
//  Created by Gabriel on 4/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelper.h"

#import "KBKext.h"
#import "KBLogger.h"
#import <MPMessagePack/MPXPCProtocol.h>

@interface KBHelper ()
@property NSTask *redirector;
@end

@implementation KBHelper

+ (int)run {
  NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
  NSString *build = NSBundle.mainBundle.infoDictionary[@"KBBuild"];

  KBLog(@"Starting keybase.Helper: %@ (%@)", version, build);

  xpc_connection_t service = xpc_connection_create_mach_service("keybase.Helper", dispatch_get_main_queue(), XPC_CONNECTION_MACH_SERVICE_LISTENER);
  if (!service) {
    KBLog(@"Failed to create service.");
    return EXIT_FAILURE;
  }

  @try {
    KBHelper *helper = [[KBHelper alloc] init];
    [helper listen:service];

    dispatch_main();
  } @catch(NSException *e) {
    KBLog(@"Exception: %@", e);
  }

  return 0;
}

- (void)handleRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSNumber *)messageId completion:(void (^)(NSError *error, id value))completion {
  @try {
    [self _handleRequestWithMethod:method params:params messageId:messageId completion:completion];
  } @catch (NSException *e) {
    KBLog(@"Exception: %@", e);
    completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Exception: %@", e), nil);
  }
}

- (NSString *)checkKextID:(NSString *)kextID {
  NSString * const kbfuseKextID = @"com.github.kbfuse.filesystems.kbfuse";
  NSString * const fuse3KextID = @"com.github.osxfuse.filesystems.osxfuse";
  if ([kextID isEqualToString:kbfuseKextID]) return kbfuseKextID;
  if ([kextID isEqualToString:fuse3KextID]) return fuse3KextID;
  return nil;
}

- (void)_handleRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSNumber *)messageId completion:(void (^)(NSError *error, id value))completion {
  NSDictionary *args = [params count] == 1 ? params[0] : @{};

  KBLog(@"Request: %@(%@)", method, args);

  if (![args isKindOfClass:NSDictionary.class]) {
    completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Invalid args"), nil);
    return;
  }

  if ([method isEqualToString:@"version"]) {
    [self version:completion];
  } else if ([method isEqualToString:@"kextLoad"]) {
    [KBKext loadKextID:args[@"kextID"] path:args[@"kextPath"] completion:completion];
  } else if ([method isEqualToString:@"kextUnload"]) {
    // For some reason passing through args[@"kextID"] causes the helper to crash on kextUnload only.
    // TODO: Figure out why. (Maybe string has to be const?)
    NSString *kextID = [self checkKextID:args[@"kextID"]];
    if (kextID) {
      [KBKext unloadKextID:kextID completion:completion];
    } else {
      completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Invalid kextID"), nil);
    }
  } else if ([method isEqualToString:@"kextInstall"]) {
    [KBKext installWithSource:args[@"source"] destination:args[@"destination"] kextID:args[@"kextID"] kextPath:args[@"kextPath"] completion:completion];
  } else if ([method isEqualToString:@"kextUninstall"]) {
    [KBKext uninstallWithDestination:args[@"destination"] kextID:args[@"kextID"] completion:completion];
  } else if ([method isEqualToString:@"kextCopy"]) {
    [KBKext copyWithSource:args[@"source"] destination:args[@"destination"] removeExisting:YES completion:completion];
  } else if ([method isEqualToString:@"remove"]) {
    [self remove:args[@"path"] completion:completion];
  } else if ([method isEqualToString:@"move"]) {
    [self moveFromSource:args[@"source"] destination:args[@"destination"] overwriteDestination:YES completion:completion];
  } else if ([method isEqualToString:@"createDirectory"]) {
    [self createDirectory:args[@"directory"] uid:args[@"uid"] gid:args[@"gid"] permissions:args[@"permissions"] excludeFromBackup:[args[@"excludeFromBackup"] boolValue] completion:completion];
  } else if ([method isEqualToString:@"addToPath"]) {
    [self addToPath:args[@"directory"] name:args[@"name"] appName:args[@"appName"] completion:completion];
  } else if ([method isEqualToString:@"removeFromPath"]) {
    [self removeFromPath:args[@"directory"] name:args[@"name"] appName:args[@"appName"] completion:completion];
  } else if ([method isEqualToString:@"startRedirector"]) {
    [self startRedirector:args[@"directory"] uid:args[@"uid"] gid:args[@"gid"] permissions:args[@"permissions"] excludeFromBackup:[args[@"excludeFromBackup"] boolValue] redirectorBin:args[@"redirectorBin"] completion:completion];
  } else if ([method isEqualToString:@"stopRedirector"]) {
    [self stopRedirector:args[@"directory"] completion:completion];
  } else {
    completion(KBMakeError(MPXPCErrorCodeUnknownRequest, @"Unknown request method"), nil);
  }
}

- (void)version:(void (^)(NSError *error, id value))completion {
  NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
  NSString *build = NSBundle.mainBundle.infoDictionary[@"KBBuild"];
  NSDictionary *response = @{
                             @"version": version,
                             @"build": build,
                             };
  completion(nil, response);
}

- (void)createDirectory:(NSString *)directory uid:(NSNumber *)uid gid:(NSNumber *)gid permissions:(NSNumber *)permissions excludeFromBackup:(BOOL)excludeFromBackup completion:(void (^)(NSError *error, id value))completion {
  NSMutableDictionary *attributes = [NSMutableDictionary dictionary];
  attributes[NSFilePosixPermissions] = permissions;
  attributes[NSFileOwnerAccountID] = uid;
  attributes[NSFileGroupOwnerAccountID] = gid;

  NSError *error = nil;
  if (![NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:attributes error:&error]) {
    completion(error, nil);
    return;
  }

  if (excludeFromBackup) {
    NSURL *directoryURL = [NSURL fileURLWithPath:directory];
    OSStatus status = CSBackupSetItemExcluded((__bridge CFURLRef)directoryURL, YES, YES);
    if (status != noErr) {
      completion(KBMakeError(status, @"Error trying to exclude from backup"), nil);
      return;
    }
  }

  completion(nil, @{});
}

- (NSURL *)copyBinaryForHelperUse:(NSString *)bin name:(NSString *)name error:(NSError **)error {
    NSURL *directoryURL = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:[[NSProcessInfo processInfo] globallyUniqueString]] isDirectory:YES];
    NSMutableDictionary *attributes = [NSMutableDictionary dictionary];
    attributes[NSFilePosixPermissions] = [NSNumber numberWithShort:0700];
    attributes[NSFileOwnerAccountID] = 0;
    attributes[NSFileGroupOwnerAccountID] = 0;
    if (![[NSFileManager defaultManager] createDirectoryAtURL:directoryURL withIntermediateDirectories:YES attributes:attributes error:error]) {
      return nil;
    }

    NSURL *srcURL = [NSURL fileURLWithPath:bin];
    NSURL *dstURL = [directoryURL URLByAppendingPathComponent:name isDirectory:NO];
    if (![[NSFileManager defaultManager] copyItemAtURL:srcURL toURL:dstURL error:error]) {
      return nil;
    }

    return dstURL;
}

- (void)checkKeybaseBinary:(NSURL *)bin error:(NSError **)error {
    SecStaticCodeRef staticCode = NULL;
    CFURLRef url = (__bridge CFURLRef)bin;
    SecStaticCodeCreateWithPath(url, kSecCSDefaultFlags, &staticCode);
    SecRequirementRef keybaseRequirement = NULL;
    // This requirement string is taken from Installer/Info.plist.
    SecRequirementCreateWithString(CFSTR("anchor apple generic and identifier \"keybase-redirector\" and (certificate leaf[field.1.2.840.113635.100.6.1.9] /* exists */ or certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = \"99229SGT5K\")"), kSecCSDefaultFlags, &keybaseRequirement);
    OSStatus codeCheckResult = SecStaticCodeCheckValidityWithErrors(staticCode, kSecCSDefaultFlags, keybaseRequirement, NULL);
    if (codeCheckResult != errSecSuccess) {
      *error = KBMakeError(codeCheckResult, @"Binary not signed by Keybase");
    }
}

- (void)unmount:(NSString *)mount error:(NSError **)error {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = @"/usr/sbin/diskutil";
  task.arguments = @[@"unmountDisk", @"force", mount];

  @try {
    [task launch];
    [task waitUntilExit];
  } @catch (NSException *e) {
    NSString *errorMessage = [NSString stringWithFormat:@"%@ (unmount)", e.reason];
    *error = KBMakeError(-1, errorMessage);
  }
}

- (void)startRedirector:(NSString *)directory uid:(NSNumber *)uid gid:(NSNumber *)gid permissions:(NSNumber *)permissions excludeFromBackup:(BOOL)excludeFromBackup redirectorBin:(NSString *)redirectorBin completion:(void (^)(NSError *error, id value))completion {
  if (self.redirector) {
    // Already started.
    completion(nil, @{});
    return;
  }

  // Unmount anything that's already mounted there.
  NSError *error = nil;
  [self unmount:directory error:&error];
  if (error) {
    completion(error, nil);
    return;
  }

  // First create the directory.
  [self createDirectory:directory uid:uid gid:gid permissions:permissions excludeFromBackup:excludeFromBackup completion:^(NSError *err, id value) {
    if (err) {
      completion(err, value);
      return;
    }

    // Copy the binary to a root-only location so it can't be
    // subsequently modified by a user after we check it.
    NSError *error = nil;
    NSURL *dstURL = [self copyBinaryForHelperUse:redirectorBin name:@"keybase-redirector" error:&error];
    if (error) {
      completion(error, nil);
      return;
    }

    // Make sure the passed-in redirector binary points to a proper binary
    // signed by Keybase, we don't want this to be able to run arbitrary code
    // as root.
    [self checkKeybaseBinary:dstURL error:&error];
    if (error) {
      completion(error, nil);
      return;
    }

    NSTask *task = [[NSTask alloc] init];
    task.launchPath = dstURL.path;
    task.arguments = @[directory];
    self.redirector = task;
    [self.redirector launch];
    completion(nil, value);
  }];
}

- (void)stopRedirector:(NSString *)directory completion:(void (^)(NSError *error, id value))completion {
  NSError *error = nil;
  [self unmount:directory error:&error];
  if (error) {
    completion(error, nil);
    return;
  }

  if (self.redirector) {
    [self.redirector terminate];
    self.redirector = nil;
  }

  completion(nil, @{});
}

- (BOOL)linkExists:(NSString *)linkPath {
  NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:linkPath error:nil];
  if (!attributes) {
    return NO;
  }
  return [attributes[NSFileType] isEqual:NSFileTypeSymbolicLink];
}

- (NSString *)resolveLinkPath:(NSString *)linkPath {
  if (![self linkExists:linkPath]) {
    return nil;
  }
  return [NSFileManager.defaultManager destinationOfSymbolicLinkAtPath:linkPath error:nil];
}

- (BOOL)createLinkIfNoLinkExists:(NSString *)path linkPath:(NSString *)linkPath uid:(uid_t)uid gid:(gid_t)gid {
  if ([NSFileManager.defaultManager createSymbolicLinkAtPath:linkPath withDestinationPath:path error:nil]) {
    // setAttributes doesn't work with symlinks, so we have to call lchown() directly
    const char *file = [NSFileManager.defaultManager fileSystemRepresentationWithPath:linkPath];
    if (lchown(file, uid, gid) == 0) {
      return YES;
    }
  }
  return NO;
}

- (BOOL)createLink:(NSString *)path linkPath:(NSString *)linkPath uid:(uid_t)uid gid:(gid_t)gid {
  if ([NSFileManager.defaultManager fileExistsAtPath:linkPath]) {
    [NSFileManager.defaultManager removeItemAtPath:linkPath error:nil];
  }
  return [self createLinkIfNoLinkExists:path linkPath:linkPath uid:uid gid:gid];
}

- (void)addToPath:(NSString *)directory name:(NSString *)name appName:(NSString *)appName completion:(void (^)(NSError *error, id value))completion {
  NSString *path = [NSString stringWithFormat:@"%@/%@", directory, name];
  NSString *linkDir = @"/usr/local/bin";
  NSString *linkPath = [NSString stringWithFormat:@"%@/%@", linkDir, name];

  // Check if link dir exists and resolves correctly
  if ([NSFileManager.defaultManager fileExistsAtPath:linkDir]) {
    NSString *resolved = [self resolveLinkPath:linkPath];
    // Check if we're linked properly at /usr/local/bin
    if ([resolved isEqualToString:path]) {
      completion(nil, @{@"path": linkPath});
      return;
    }

    // Fix the link
    NSDictionary *dirAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:linkDir error:nil];
    uid_t uid = [dirAttributes[NSFileOwnerAccountID] intValue];
    gid_t gid = [dirAttributes[NSFileGroupOwnerAccountID] intValue];
    KBLog(@"Fixing symlink: %@, %@ (%@,%@)", linkPath, path, @(uid), @(gid));
    if (dirAttributes && [self createLink:path linkPath:linkPath uid:uid gid:gid]) {
      completion(nil, @{@"path": linkPath});
      return;
    }
  }


  // If we don't have a /usr/local/bin then fall back to /etc/paths.d.
  // Terminal will load /etc/profile, which uses /usr/libexec/path_helper which loads paths from /etc/paths.d.
  // Some users will override the default usage of /etc/profile in Terminal though so this isn't guaranteed to
  // include keybase in the path on those systems, however, these two cases should handle most of our users.

  NSString *pathsd = @"/etc/paths.d";

  // On fresh Sierra install, /etc/paths.d doesn't exist
  if (![NSFileManager.defaultManager fileExistsAtPath:pathsd]) {
    NSError *error = nil;
    if (![NSFileManager.defaultManager createDirectoryAtPath:pathsd withIntermediateDirectories:NO attributes:nil error:&error]) {
      completion(error, nil);
      return;
    }
  }

  NSString *pathsdPath = [NSString stringWithFormat:@"%@/%@", pathsd, appName];
  if ([NSFileManager.defaultManager fileExistsAtPath:pathsdPath]) {
    completion(nil, nil);
    return;
  }
  NSError *error = nil;
  [directory writeToFile:pathsdPath atomically:YES encoding:NSUTF8StringEncoding error:&error];
  completion(error, @{@"path": pathsdPath});
}

- (void)removeFromPath:(NSString *)directory name:(NSString *)name appName:(NSString *)appName completion:(void (^)(NSError *error, id value))completion {
  NSString *path = [NSString stringWithFormat:@"%@/%@", directory, name];
  NSString *linkPath = [NSString stringWithFormat:@"/usr/local/bin/%@", name];
  NSString *resolved = [self resolveLinkPath:linkPath];
  NSMutableArray *removePaths = [NSMutableArray array];

  if ([resolved isEqualToString:path]) {
    [removePaths addObject:linkPath];
  }

  NSString *pathsdPath = [NSString stringWithFormat:@"/etc/paths.d/%@", appName];
  if ([NSFileManager.defaultManager fileExistsAtPath:pathsdPath]) {
    [removePaths addObject:pathsdPath];
  }

  NSMutableArray *errors = [NSMutableArray array];
  for (NSString *path in removePaths) {
    NSError *error = nil;
    if (![NSFileManager.defaultManager removeItemAtPath:path error:&error]) {
      [errors addObject:KBMakeError(error.code, @"Failed to remove path: %@", path)];
    }
  }

  if ([errors count] > 0) {
    completion(KBMakeError(-1, @"%@", [errors componentsJoinedByString:@". "]), @{@"paths": removePaths});
  } else {
    completion(nil, @{@"paths": removePaths});
  }
}

- (void)moveFromSource:(NSString *)source destination:(NSString *)destination overwriteDestination:(BOOL)overwriteDestination completion:(void (^)(NSError *error, id value))completion {
  NSError *error = nil;
  if ([NSFileManager.defaultManager fileExistsAtPath:destination isDirectory:NULL] && ![NSFileManager.defaultManager removeItemAtPath:destination error:&error]) {
    completion(error, nil);
    return;
  }

  if (![NSFileManager.defaultManager moveItemAtPath:source toPath:destination error:&error]) {
    completion(error, nil);
    return;
  }

  completion(nil, @{});
}

- (void)remove:(NSString *)path completion:(void (^)(NSError *error, id value))completion {
  NSError *error = nil;
  // The caller will check the path too but let's be safer and prevent some bad paths
  if (!path || ![path hasPrefix:@"/"] || [path isEqualToString:@"/"]) {
    completion(KBMakeError(MPXPCErrorCodeInvalidRequest, @"Invalid path"), nil);
    return;
  }

  if (![NSFileManager.defaultManager removeItemAtURL:[NSURL fileURLWithPath:path] error:&error]) {
    completion(error, nil);
    return;
  }
  completion(nil, @{});
}

@end
