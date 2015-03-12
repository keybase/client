//
//  KBAppearance.h
//  KBAppKit
//
//  Created by Gabriel on 2/20/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

// NSColor *color = GHNSColorFromRGB(0xBC1128);
#define GHNSColorFromRGB(rgbValue) [NSColor colorWithRed:((float)((rgbValue & 0xFF0000) >> 16))/255.0 green:((float)((rgbValue & 0xFF00) >> 8))/255.0 blue:((float)(rgbValue & 0xFF))/255.0 alpha:1.0]

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
  KBHorizontalAlignmentLeft,
  KBHorizontalAlignmentCenter,
  KBHorizontalAlignmentRight
};

@protocol KBAppearance

- (NSColor *)textColor;
- (NSColor *)secondaryTextColor;
- (NSColor *)selectColor;
- (NSColor *)disabledTextColor;
- (NSColor *)selectedTextColor;

- (NSColor *)okColor;
- (NSColor *)warnColor;
- (NSColor *)errorColor;

- (NSColor *)greenColor;

- (NSColor *)lineColor;
- (NSColor *)secondaryLineColor;

- (NSColor *)highlightBackgroundColor;

- (NSFont *)textFont;
- (NSFont *)smallTextFont;
- (NSFont *)boldTextFont;
- (NSFont *)boldLargeTextFont;
- (NSFont *)boldLargerTextFont;
- (NSFont *)buttonFont;

- (NSColor *)backgroundColor;
- (NSColor *)secondaryBackgroundColor;

- (NSColor *)tableGridColor;

@end

@interface KBAppearance : NSObject

+ (void)setCurrentAppearance:(id<KBAppearance>)appearance;
+ (id<KBAppearance>)currentAppearance;

+ (id<KBAppearance>)darkAppearance;
+ (id<KBAppearance>)lightAppearance;

@end

@interface KBAppearanceLight : NSObject <KBAppearance>
@end

@interface KBAppearanceDark : KBAppearanceLight <KBAppearance>
@end

