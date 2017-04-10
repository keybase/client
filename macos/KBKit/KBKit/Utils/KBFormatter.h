//
//  KBFormatter.h
//  Keybase
//
//  Created by Gabriel on 5/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <GHODictionary/GHODictionary.h>

@interface KBFormatter : NSObject

@end

NSString *KBDescription(id obj);
NSString *KBHexString(NSData *data, NSString *defaultValue);
NSData *KBHexData(NSString *s);

GHODictionary *KBObjectToDictionary(id obj, BOOL includeNull);
NSString *KBClassNameOfPropertyNamed(Class clazz, NSString *propertyName);
NSArray *KBPropertyNames(Class clazz);
