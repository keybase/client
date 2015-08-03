//
//  KBRRequestParams.h
//  Keybase
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBRRequestParams : NSObject

- (instancetype)initWithParams:(NSArray *)params;

+ (instancetype)params;

@end
