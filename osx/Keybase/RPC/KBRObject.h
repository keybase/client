//
//  KBRObject.h
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <Mantle/Mantle.h>

@interface KBRObject : MTLModel <MTLJSONSerializing>

- (NSString *)propertiesDescription:(NSString *)prefix;

@end
