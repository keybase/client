//
//  KBAppKitDefines.h
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <AppKit/AppKit.h>
#import <GHKit/GHKit.h>
#import <YOLayout/YOLayout.h>

// NSColor *color = GHNSColorFromRGB(0xBC1128);
#define GHNSColorFromRGB(rgbValue) [NSColor colorWithRed:((float)((rgbValue & 0xFF0000) >> 16))/255.0 green:((float)((rgbValue & 0xFF00) >> 8))/255.0 blue:((float)(rgbValue & 0xFF))/255.0 alpha:1.0]

#define KBDebugAlert(DESC, WINDOW) ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:DESC}]] beginSheetModalForWindow:WINDOW ? WINDOW : [NSApp mainWindow] completionHandler:nil])

#define KBDebugAlertModal(DESC) ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:DESC}]] runModal])

#define KBTODO() ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:@"TODO"}]] beginSheetModalForWindow:[NSApp mainWindow] completionHandler:nil])



static inline CGRect KBCGRectInset(CGRect rect, UIEdgeInsets insets) {
  CGSize size = rect.size;
  return CGRectMake(insets.left, insets.top, size.width - insets.right - insets.left, size.height - insets.top - insets.bottom);
}

typedef NS_ENUM(NSInteger, KBVerticalAlignment) {
  KBVerticalAlignmentNone,
  KBVerticalAlignmentTop,
  KBVerticalAlignmentMiddle,
  KBVerticalAlignmentBottom,
  KBVerticalAlignmentBaseline,
};

typedef NS_ENUM(NSInteger, KBHorizontalAlignment) {
  KBHorizontalAlignmentNone,
  KBHorizontalAlignmentLeft,
  KBHorizontalAlignmentCenter,
  KBHorizontalAlignmentRight
};

typedef void (^KBErrorHandler)(NSError *error, id sender);
