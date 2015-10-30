//
//  KBPrefOption.h
//  Keybase
//
//  Created by Gabriel on 4/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBPrefOption : NSObject

@property NSString *label;
@property id value;

+ (instancetype)prefOptionWithLabel:(NSString *)label value:(id)value;

@end
