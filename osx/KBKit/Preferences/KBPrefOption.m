//
//  KBPrefOption.m
//  Keybase
//
//  Created by Gabriel on 4/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefOption.h"

@implementation KBPrefOption

+ (instancetype)prefOptionWithLabel:(NSString *)label value:(id)value {
  KBPrefOption *prefOption = [[KBPrefOption alloc] init];
  prefOption.label = label;
  prefOption.value = value;
  return prefOption;
}

@end
