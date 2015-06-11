//
//  KBHeaderLabelView.h
//  Keybase
//
//  Created by Gabriel on 3/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>

@interface KBHeaderLabelView : YOView

@property float columnRatio; // For header width based on ratio
@property CGFloat columnWidth; // For fixed header width

+ (instancetype)headerLabelViewWithHeader:(NSString *)header headerOptions:(KBTextOptions)headerOptions text:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options lineBreakMode:(NSLineBreakMode)lineBreakMode;

- (void)setHeader:(NSString *)header;

- (void)addText:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options lineBreakMode:(NSLineBreakMode)lineBreakMode targetBlock:(dispatch_block_t)targetBlock;

@end