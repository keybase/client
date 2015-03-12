//
//  KBFoldersView.h
//  Keybase
//
//  Created by Gabriel on 3/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBFolderListView.h"

@interface KBFoldersView : KBView

@property (readonly) KBFolderListView *favoritesView;
@property (readonly) KBFolderListView *foldersView;

@end
