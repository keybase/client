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

@end

// Validate the array and that it contains all elements of class
NSArray *KBRValidateArray(id array, Class clazz);

// Validate the dictionary and that it contains all keys of string and values of class
NSDictionary *KBRValidateDictionary(id dict, Class clazz);