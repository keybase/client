//
//  KBAppBundle.m
//  KBKit
//
//  Created by Gabriel on 2/1/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import "KBAppBundle.h"

#import "KBHelperTool.h"

@interface KBAppBundle ()
@property NSString *path;
@end

@implementation KBAppBundle

- (instancetype)initWithPath:(NSString *)path {
  if ((self = [super init])) {
    _path = path;
  }
  return self;
}

- (void)uninstall:(KBCompletion)completion {
  MPXPCClient *helper = [KBHelperTool helper];
  // Only remove from approved locations
  if (![_path isEqualToString:@"/Applications/Keybase.app"]) {
    completion(KBMakeError(-1, @"Not approved to uninstall: %@", _path));
    return;
  }
  if (![NSFileManager.defaultManager fileExistsAtPath:_path]) {
    DDLogInfo(@"No app to uninstall");
    completion(nil);
    return;
  }
  NSDictionary *params = @{@"source": _path, @"destination": @"/tmp/Keybase.app"};
  [helper sendRequest:@"move" params:@[params] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

@end
