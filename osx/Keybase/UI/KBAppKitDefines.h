//
//  KBAppKitDefines.h
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

// NSColor *color = GHNSColorFromRGB(0xBC1128);
#define GHNSColorFromRGB(rgbValue) [NSColor colorWithCalibratedRed:((float)((rgbValue & 0xFF0000) >> 16))/255.0 green:((float)((rgbValue & 0xFF00) >> 8))/255.0 blue:((float)(rgbValue & 0xFF))/255.0 alpha:1.0]

#define KBDebugAlert(DESC) ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:DESC}]] beginSheetModalForWindow:[NSApp mainWindow] completionHandler:nil])

#define KBTODO() ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:@"TODO"}]] beginSheetModalForWindow:[NSApp mainWindow] completionHandler:nil])

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
