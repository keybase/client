//
//  KBLoginItem.m
//  KBKit
//
//  Created by Gabriel on 12/21/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import "KBLoginItem.h"
#import "KBSharedFileList.h"

@interface KBLoginItem ()
@property NSURL *URL;
@end

@implementation KBLoginItem

- (instancetype)initWithURL:(NSURL *)URL {
  if ((self = [super init])) {
    self.URL = URL;
  }
  return self;
}

+ (BOOL)setEnabled:(BOOL)loginEnabled URL:(NSURL *)URL error:(NSError **)error {
  KBLoginItem *loginItem = [[KBLoginItem alloc] initWithURL:URL];
  return [loginItem setEnabled:loginEnabled error:error];
}

+ (BOOL)isEnabledForURL:(NSURL *)URL {
  KBLoginItem *loginItem = [[KBLoginItem alloc] initWithURL:URL];
  return [loginItem isEnabled];
}

- (BOOL)isEnabled {
  return [KBSharedFileList isEnabledForURL:self.URL type:kLSSharedFileListSessionLoginItems];
}

- (BOOL)setEnabled:(BOOL)loginEnabled error:(NSError **)error {
  return [KBSharedFileList setEnabled:loginEnabled URL:self.URL name:@"Keybase" type:kLSSharedFileListSessionLoginItems position:NSIntegerMax error:error];
}

@end
