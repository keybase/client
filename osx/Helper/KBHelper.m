//
//  KBHelper.m
//  Keybase
//
//  Created by Gabriel on 4/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelper.h"

#import "KBFS.h"
#import "KBHelperDefines.h"
#import "KBLaunchCtl.h"

@implementation KBHelper

- (void)handleRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSNumber *)messageId completion:(void (^)(NSError *error, id value))completion {

  KBLog(@"Request: %@(%@)", method, params ? params : @"");

  NSString *fuseBundle = @"/Applications/Keybase.app/Contents/Resources/osxfusefs.fs.bundle";
  KBFS *kbfs = [[KBFS alloc] initWithPath:fuseBundle];

  if ([method isEqualToString:@"version"]) {
    NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
    NSDictionary *response = @{
                               @"version": version,
                               @"fuseBundleVersion": KBOrNull(kbfs.sourceVersion),
                               @"fuseInstallVersion": KBOrNull(kbfs.destinationVersion),
                               };
    completion(nil, response);
  } else if ([method isEqualToString:@"status"]) {
    [kbfs status:completion];
  } else if ([method isEqualToString:@"load_kbfs"]) {
    [kbfs load:completion];
  } else if ([method isEqualToString:@"unload_kbfs"]) {
    [kbfs unload:completion];
  } else if ([method isEqualToString:@"uninstall_kbfs"]) {
    [kbfs uninstall:completion];
  } else {
    completion(KBMakeError(MPXPCErrorCodeUnknownRequest, @"Unknown request method"), nil);
  }
}

/*
- (void)uninstall:(KBOnCompletion)completion {
  NSString *plist = @"/Library/LaunchDaemons/keybase.Helper.plist";
  [KBLaunchCtl unload:plist disable:NO completion:^(NSError *error, NSString *output) {
    [NSFileManager.defaultManager removeItemAtPath:plist error:nil];
    [NSFileManager.defaultManager removeItemAtPath:@"/Library/PrivilegedHelperTools/keybase.Helper" error:nil];
    completion(nil, nil);
  }];
}
 */

@end
