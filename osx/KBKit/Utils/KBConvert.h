//
//  KBConvert.h
//  Keybase
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

void KBConvertArrayTo(NSMutableArray *array);
void KBConvertArrayFrom(NSMutableArray *array);

void KBConvertDictTo(NSMutableDictionary *dict);
void KBConvertDictFrom(NSMutableDictionary *dict);

typedef id (^KBCoverter)(id obj);
void KBConvertArray(NSMutableArray *array, Class clazz, KBCoverter converter);
void KBConvertDict(NSMutableDictionary *dict, Class clazz, KBCoverter converter);
id KBConvertObject(id item, Class clazz, KBCoverter converter);

