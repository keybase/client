//
//  KBLoginItem.m
//  KBKit
//
//  Created by Gabriel on 12/21/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import "KBLoginItem.h"

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

+ (BOOL)setLoginEnabled:(BOOL)loginEnabled URL:(NSURL *)URL error:(NSError **)error {
  KBLoginItem *loginItem = [[KBLoginItem alloc] initWithURL:URL];
  return [loginItem setLoginEnabled:loginEnabled error:error];
}

+ (BOOL)isLoginEnabledForURL:(NSURL *)URL {
  KBLoginItem *loginItem = [[KBLoginItem alloc] initWithURL:URL];
  return [loginItem isLoginEnabled];
}

- (void)findLoginItemForURL:(NSURL *)URL completion:(void (^)(LSSharedFileListRef loginItems, LSSharedFileListItemRef item))completion {
  LSSharedFileListRef loginItemsRef = LSSharedFileListCreate(NULL, kLSSharedFileListSessionLoginItems, NULL);
  if (!loginItemsRef) return;

  UInt32 seed = 0U;
  BOOL found = NO;
  CFArrayRef currentLoginItemsRef = LSSharedFileListCopySnapshot(loginItemsRef, &seed);
  NSArray *currentLoginItems = (__bridge NSArray *)currentLoginItemsRef;
  for (id itemObject in currentLoginItems) {
    LSSharedFileListItemRef itemRef = (__bridge LSSharedFileListItemRef)itemObject;

    UInt32 resolutionFlags = kLSSharedFileListNoUserInteraction | kLSSharedFileListDoNotMountVolumes;
    CFErrorRef errorRef;
    CFURLRef URLRef = LSSharedFileListItemCopyResolvedURL(itemRef, resolutionFlags, &errorRef);
    if ([URL isEqualTo:(__bridge NSURL *)URLRef]) {
      completion(loginItemsRef, itemRef);
      found = YES;
      break;
    }
  }

  if (!found) {
    completion(loginItemsRef, NULL);
  }

  CFRelease(currentLoginItemsRef);
  CFRelease(loginItemsRef);
}

- (BOOL)isLoginEnabled {
  __block BOOL found;
  [self findLoginItemForURL:self.URL completion:^(LSSharedFileListRef loginItems, LSSharedFileListItemRef item) {
    found = (item != NULL);
  }];
  return found;
}

- (BOOL)setLoginEnabled:(BOOL)loginEnabled error:(NSError **)error {
  __block BOOL changed;
  __block NSError *bError;
  [self findLoginItemForURL:self.URL completion:^(LSSharedFileListRef loginItems, LSSharedFileListItemRef itemRef) {
    if (loginEnabled && !itemRef) {
      itemRef = LSSharedFileListInsertItemURL(loginItems, kLSSharedFileListItemLast, (CFStringRef)@"Keybase", NULL, (__bridge CFURLRef)self.URL, NULL, NULL);
      CFRelease(itemRef);
      changed = YES;
    } else if (!loginEnabled && itemRef) {
      OSStatus status = LSSharedFileListItemRemove(loginItems, itemRef);
      if (status != noErr) {
        bError = KBMakeError(status, @"Error removing login item: %@", @(status));
      } else {
        changed = YES;
      }
    }
  }];

  if (error) *error = bError;
  return changed;
}



@end
