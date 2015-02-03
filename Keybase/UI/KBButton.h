//
//  KBButton.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

typedef void (^KBButtonTargetBlock)();

typedef NS_ENUM (NSInteger, KBButtonStyle) {
  KBButtonStyleDefault,
  KBButtonStylePrimary,
  KBButtonStyleLink,
};

@interface KBButton : NSButton

@property (nonatomic, copy) KBButtonTargetBlock targetBlock;

+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style;

+ (instancetype)buttonWithImage:(NSImage *)image;

- (void)setText:(NSString *)text style:(KBButtonStyle)style;

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

@end

@interface KBButtonCell : NSButtonCell

@property KBButtonStyle style;

- (void)setText:(NSString *)text alignment:(NSTextAlignment)alignment;

@end

