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

#define KBDefaultButtonHeight (56)

@interface KBButton : NSButton

@property (nonatomic, copy) KBButtonTargetBlock targetBlock;

+ (instancetype)buttonWithLinkText:(NSString *)text;

+ (instancetype)buttonWithLinkText:(NSString *)text font:(NSFont *)font alignment:(NSTextAlignment)alignment;

+ (instancetype)buttonWithText:(NSString *)text;

+ (instancetype)buttonWithImage:(NSImage *)image;

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment;

@end

