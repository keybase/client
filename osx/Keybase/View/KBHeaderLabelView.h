//
//  KBHeaderLabelView.h
//  Keybase
//
//  Created by Gabriel on 3/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"

@interface KBHeaderLabelView : YOView

+ (instancetype)headerLabelViewWithHeader:(NSString *)header headerOptions:(KBTextOptions)headerOptions headerWidth:(CGFloat)headerWidth text:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setHeader:(NSString *)header;

- (void)addText:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options lineBreakMode:(NSLineBreakMode)lineBreakMode targetBlock:(dispatch_block_t)targetBlock;

@end