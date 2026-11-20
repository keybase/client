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

+ (void)findItemForName:(NSString *)name URL:(NSURL *)URL type:(CFStringRef)type completion:(void (^)(LSSharedFileListRef fileListRef, CFArrayRef itemsRef, NSArray */*LSSharedFileListItemRef*/matchedItems, NSInteger firstPosition))completion {
  LSSharedFileListRef fileListRef = LSSharedFileListCreate(NULL, type, NULL);
  if (!fileListRef) return;

  UInt32 seed = 0U;
  NSMutableArray *foundItems = [NSMutableArray array];
  CFArrayRef itemsRef = LSSharedFileListCopySnapshot(fileListRef, &seed);
  NSArray *items = (__bridge NSArray *)itemsRef;
  NSInteger firstPosition = -1;

  NSInteger position = 1;
  for (id itemObject in items) {
    LSSharedFileListItemRef itemRef = (__bridge LSSharedFileListItemRef)itemObject;

    BOOL matched = NO;
    if (name) {
      CFStringRef displayNameRef = LSSharedFileListItemCopyDisplayName(itemRef);
      if (displayNameRef) {
        if ([name isEqual:(__bridge NSString *)(displayNameRef)]) {
          matched = YES;
        }
        CFRelease(displayNameRef);
      }
    }

    if (!matched && URL) {
      // On El Capitan, the URLRef is null if the mount or path is invalid
      UInt32 resolutionFlags = kLSSharedFileListNoUserInteraction | kLSSharedFileListDoNotMountVolumes;
      CFErrorRef errorRef;
      CFURLRef URLRef = LSSharedFileListItemCopyResolvedURL(itemRef, resolutionFlags, &errorRef);
      if (URLRef) {
        NSURL *itemURL = (__bridge NSURL *)URLRef;
        if ([URL isEqual:itemURL]) {
          matched = YES;
        }
        if (URLRef != nil) {
          CFRelease(URLRef);
        }
      }
    }

    if (matched) {
      [foundItems addObject:(__bridge id _Nonnull)(itemRef)];
      if (firstPosition == -1) firstPosition = position;
    }
    position++;
  }

  completion(fileListRef, itemsRef, foundItems, firstPosition);

  CFRelease(itemsRef);
  CFRelease(fileListRef);
}

+ (void)findItemAtPosition:(NSInteger)position type:(CFStringRef)type completion:(void (^)(LSSharedFileListItemRef itemRef))completion {
  if (position < 1) {
    completion(kLSSharedFileListItemBeforeFirst);
    return;
  }

  LSSharedFileListRef fileListRef = LSSharedFileListCreate(NULL, type, NULL);
  if (!fileListRef) return;
  UInt32 seed = 0U;
  CFArrayRef itemsRef = LSSharedFileListCopySnapshot(fileListRef, &seed);
  NSArray *items = (__bridge NSArray *)itemsRef;
  if (position > [items count]) {
    completion(kLSSharedFileListItemLast);
    return;
  }
  LSSharedFileListItemRef itemRef = (__bridge LSSharedFileListItemRef)[items objectAtIndex:position-1];
  completion(itemRef);
  CFRelease(itemsRef);
  CFRelease(fileListRef);
}

+ (BOOL)setEnabled:(BOOL)enabled URL:(NSURL *)URL name:(NSString *)name type:(CFStringRef)type position:(NSInteger)position error:(NSError **)error {
  __block BOOL changed = NO;
  __block NSError *bError = nil;
  // Good to use name to match (since on El Capitan the URL can be invalid)
  [self findItemForName:name URL:URL type:type completion:^(LSSharedFileListRef fileListRef, CFArrayRef itemsRef, NSArray */*LSSharedFileListItemRef*/matchedItems, NSInteger firstPosition) {
    // If not enabling, clear all matched items.
    // If matchedItems count is > 1, then let's clear the found items, and re-add a single item, which fixes an issue with duplicates.
    if (!enabled || [matchedItems count] > 1) {
      for (id item in matchedItems) {
        changed = YES;
        LSSharedFileListItemRemove(fileListRef, (__bridge LSSharedFileListItemRef)item);
      }
      matchedItems = [NSArray array];
    }

    if (enabled && [matchedItems count] == 0) {
      [self findItemAtPosition:position-1 type:type completion:^(LSSharedFileListItemRef insertAfter) {
        LSSharedFileListItemRef itemRef = LSSharedFileListInsertItemURL(fileListRef, insertAfter, (__bridge CFStringRef)name, NULL, (__bridge CFURLRef)URL, NULL, NULL);
        if (!itemRef) {
          bError = KBMakeError(-1, @"Error adding item");
        } else {
          CFRelease(itemRef);
          changed = YES;
        }
      }];
    }
  }];

  if (error) *error = bError;
  return changed;
}

+ (NSInteger)firstPositionForURL:(NSURL *)URL type:(CFStringRef)type {
  __block NSInteger bFirstPosition = -1;
  [self findItemForName:nil URL:URL type:type completion:^(LSSharedFileListRef fileListRef, CFArrayRef itemsRef, NSArray */*LSSharedFileListItemRef*/matchedItems, NSInteger firstPosition) {
    bFirstPosition = firstPosition;
  }];
  return bFirstPosition;
}

@end
