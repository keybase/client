//
//  KBHelper.m
//  Keybase
//
//  Created by Gabriel on 4/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelper.h"

#import "KBFSInstaller.h"
#import "KBHelperDefines.h"
#import "KBHLog.h"

@implementation KBHelper

- (void)handleRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSNumber *)messageId completion:(void (^)(NSError *error, id value))completion {

  KBLog(@"Request: %@(%@)", method, params ? params : @"");

  NSString *fuseBundle = @"/Applications/Keybase.app/Contents/Resources/osxfusefs.fs.bundle";
  KBFSInstaller *installer = [[KBFSInstaller alloc] initWithPath:fuseBundle];

  if ([method isEqualToString:@"version"]) {
    NSString *version = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
    NSDictionary *response = @{
                               @"version": version,
                               @"fuseBundleVersion": KBOrNull(installer.sourceVersion),
                               @"fuseInstallVersion": KBOrNull(installer.destinationVersion),
                               };
    completion(nil, response);
  } else if ([method isEqualToString:@"install"]) {
    NSError *error = nil;
    if (![installer install:&error]) {
      if (error) {
        completion(error, @(NO));
      } else {
        completion(KBMakeError(KBErrorCodeInstaller, @"Failed with unknown error"), @(NO));
      }
    } else {
      completion(nil, @(YES));
    }
  } else {
    completion(KBMakeError(MPXPCErrorCodeUnknownRequest, @"Unknown request method"), nil);
  }

}

@end
