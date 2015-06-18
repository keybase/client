//
//  KBSelection.h
//  Keybase
//
//  Created by Gabriel on 5/29/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBTableSelection : NSObject

@property NSIndexPath *indexPath;
@property id object;

@property NSArray *indexPaths;
@property NSArray *objects;

@end
