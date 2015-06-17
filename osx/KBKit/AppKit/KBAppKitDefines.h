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
#import <YOLayout/YOBox.h>
#import <YOLayout/YOBorderLayout.h>
#import <ObjectiveSugar/ObjectiveSugar.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

#define KBDebugAlert(DESC, WINDOW) ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:DESC}]] beginSheetModalForWindow:WINDOW ? WINDOW : [NSApp mainWindow] completionHandler:nil])

#define KBDebugAlertModal(DESC) ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:DESC}]] runModal])

#define KBTodoAlert() ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:@"TODO"}]] beginSheetModalForWindow:[NSApp mainWindow] completionHandler:nil])



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
