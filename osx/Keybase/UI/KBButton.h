//
//  KBButton.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

typedef void (^KBButtonActionBlock)(id sender);

typedef NS_ENUM (NSInteger, KBButtonStyle) {
  KBButtonStyleDefault,
  KBButtonStylePrimary,
  KBButtonStyleLink,
  KBButtonStyleCheckbox,
  KBButtonStyleText,
  KBButtonStyleEmpty,
  KBButtonStyleToolbar,
};

@interface KBButton : NSButton

@property (nonatomic, copy) dispatch_block_t targetBlock; // Deprecated

@property (nonatomic, copy) KBButtonActionBlock actionBlock;

+ (instancetype)button;
+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style;
+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

+ (instancetype)buttonWithImage:(NSImage *)image;
+ (instancetype)buttonWithImage:(NSImage *)image style:(KBButtonStyle)style;

+ (instancetype)linkWithText:(NSString *)text actionBlock:(KBButtonActionBlock)actionBlock;

- (void)setText:(NSString *)text style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setText:(NSString *)text style:(KBButtonStyle)style font:(NSFont *)font alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setMarkup:(NSString *)markup style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment;

- (void)setAttributedTitle:(NSAttributedString *)attributedTitle style:(KBButtonStyle)style;

@end

@interface KBButtonCell : NSButtonCell

@property KBButtonStyle style;

- (void)setText:(NSString *)text alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setMarkup:(NSString *)markup style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment;

@end

