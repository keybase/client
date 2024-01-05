//
//  TextView.h
//  Updater
//
//  Created by Gabriel on 4/10/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

@class TextView;

typedef BOOL (^TextViewOnPaste)(TextView *textView);
typedef void (^TextViewOnChange)(TextView *textView);

@interface TextView : NSScrollView <NSTextViewDelegate>

@property (readonly) NSTextView *view;
@property (nonatomic) NSAttributedString *attributedText;
@property (nonatomic) NSString *text;
@property (nonatomic, getter=isEditable) BOOL editable;

@property (copy) TextViewOnChange onChange;
@property (copy) TextViewOnPaste onPaste;

- (void)viewInit;

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color;
- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setEnabled:(BOOL)enabled;

@end
