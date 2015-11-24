//
//  KBComponent.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBDefines.h"
#import "KBComponentStatus.h"

typedef void (^KBRefreshComponentCompletion)(KBComponentStatus *componentStatus);

@protocol KBComponent <NSObject>

- (NSString *)name;
- (NSString *)info;
- (NSImage *)image;

- (NSView *)componentView;

- (void)refreshComponent:(KBRefreshComponentCompletion)completion;

@end

@interface KBComponent : NSObject <KBComponent>

- (instancetype)initWithName:(NSString *)name info:(NSString *)info image:(NSImage *)image;

@end