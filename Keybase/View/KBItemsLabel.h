//
//  KBItemsLabel.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"

@interface KBItemsLabel : YONSView

- (void)setHeaderText:(NSString *)headerText items:(NSArray *)items texts:(NSArray *)texts font:(NSFont *)font placeHolder:(NSString *)placeHolder targetBlock:(void (^)(id sender, id object))targetBlock;

@end
