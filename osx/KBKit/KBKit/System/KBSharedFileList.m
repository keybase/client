//
//  KBSharedFileList.m
//  KBKit
//
//  Created by Gabriel on 2/23/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import "KBSharedFileList.h"
#import "KBDefines.h"

@implementation KBSharedFileList

+ (void)findLoginItemForURL:(NSURL *)URL completion:(void (^)(LSSharedFileListRef fileListRef, CFArrayRef itemsRef, LSSharedFileListItemRef itemRef))completion {
  [self findItemForURL:URL type:kLSSharedFileListSessionLoginItems completion:completion];
}

+ (void)findItemForURL:(NSURL *)URL type:(CFStringRef)type completion:(void (^)(LSSharedFileListRef fileListRef, CFArrayRef itemsRef, LSSharedFileListItemRef itemRef))completion {
  LSSharedFileListRef fileListRef = LSSharedFileListCreate(NULL, type, NULL);
  if (!fileListRef) return;

  UInt32 seed = 0U;
  BOOL found = NO;
  CFArrayRef itemsRef = LSSharedFileListCopySnapshot(fileListRef, &seed);
  NSArray *items = (__bridge NSArray *)itemsRef;
  for (id itemObject in items) {
    LSSharedFileListItemRef itemRef = (__bridge LSSharedFileListItemRef)itemObject;

    UInt32 resolutionFlags = kLSSharedFileListNoUserInteraction | kLSSharedFileListDoNotMountVolumes;
    CFErrorRef errorRef;
    CFURLRef URLRef = LSSharedFileListItemCopyResolvedURL(itemRef, resolutionFlags, &errorRef);
    if ([URL isEqualTo:(__bridge NSURL *)URLRef]) {
      completion(fileListRef, itemsRef, itemRef);
      found = YES;
      break;
    }
  }

  if (!found) {
    completion(fileListRef, itemsRef, NULL);
  }

  CFRelease(itemsRef);
  CFRelease(fileListRef);
}

+ (BOOL)setEnabled:(BOOL)enabled URL:(NSURL *)URL name:(NSString *)name type:(CFStringRef)type insertAfter:(LSSharedFileListItemRef)insertAfter auth:(BOOL)auth error:(NSError **)error {

  __block BOOL changed = NO;
  __block NSError *bError = nil;
  [self findItemForURL:URL type:type completion:^(LSSharedFileListRef fileListRef, CFArrayRef itemsRef, LSSharedFileListItemRef itemRef) {
    if (enabled && !itemRef) {
      if (auth) {
        AuthorizationRef authRef = NULL;
        AuthorizationCreate(NULL, kAuthorizationEmptyEnvironment, kAuthorizationFlagDefaults, &authRef);
        LSSharedFileListSetAuthorization(fileListRef, authRef);
      }
      itemRef = LSSharedFileListInsertItemURL(fileListRef, insertAfter, (__bridge CFStringRef)name, NULL, (__bridge CFURLRef)URL, NULL, NULL);
      if (!itemRef) {
        bError = KBMakeError(-1, @"Error adding item");
      } else {
        CFRelease(itemRef);
        changed = YES;
      }
    } else if (!enabled && itemRef) {
      if (auth) {
        AuthorizationRef authRef = NULL;
        AuthorizationCreate(NULL, kAuthorizationEmptyEnvironment, kAuthorizationFlagDefaults, &authRef);
        LSSharedFileListSetAuthorization(fileListRef, authRef);
      }
      OSStatus status = LSSharedFileListItemRemove(fileListRef, itemRef);
      if (status != noErr) {
        bError = KBMakeError(status, @"Error removing item: %@", @(status));
      } else {
        changed = YES;
      }
    }
  }];

  if (error) *error = bError;
  return changed;
}

+ (BOOL)isEnabledForURL:(NSURL *)URL type:(CFStringRef)type {
  __block BOOL found;
  [self findItemForURL:URL type:type completion:^(LSSharedFileListRef fileListRef, CFArrayRef itemsRef, LSSharedFileListItemRef itemRef) {
    found = (itemRef != NULL);
  }];
  return found;
}

@end
