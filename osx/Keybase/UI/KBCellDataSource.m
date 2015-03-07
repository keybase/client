//
//  KBCellDataSource.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCellDataSource.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBCellDataSource ()
@property NSMutableDictionary *sizeCache;
@property NSMutableDictionary *sections;
@property (nonatomic) NSInteger sectionCount;
@end

@implementation KBCellDataSource

- (NSMutableArray *)objectsForSection:(NSInteger)section create:(BOOL)create {
  //NSAssert(section > 0, @"Section must be > 0");

  if (!_sections && create) _sections = [[NSMutableDictionary alloc] init];

  NSMutableArray *objectsForSection = [_sections objectForKey:@(section)];
  if (create && !objectsForSection) {
    objectsForSection = [NSMutableArray array];
    [_sections setObject:objectsForSection forKey:@(section)];
  }
  return objectsForSection;
}

- (NSInteger)sectionCount {
  NSInteger sectionCount = [_sections count];
  if (sectionCount < _minSectionCount) return _minSectionCount;
  return sectionCount;
}

- (NSMutableArray *)objectsForSection:(NSInteger)section {
  return [self objectsForSection:section create:NO];
}

- (NSInteger)countForSection:(NSInteger)section {
  return [[self objectsForSection:section] count];
}

- (void)addObjects:(NSArray *)objects {
  [self addObjects:objects section:0 indexPaths:nil];
}

- (void)addObjects:(NSArray *)objects section:(NSInteger)section {
  [self addObjects:objects section:section indexPaths:nil];
}

- (void)addObjects:(NSArray *)objects section:(NSInteger)section indexPaths:(NSMutableArray *)indexPaths {
  NSMutableArray *objectsForSection = [self objectsForSection:section create:YES];
  NSInteger previousCount = [objectsForSection count];
  [objectsForSection addObjectsFromArray:objects];

  for(NSInteger i = 0, count = [objects count]; i < count; i++) {
    NSIndexPath *indexPath = [NSIndexPath indexPathForItem:(i + previousCount) inSection:section];
    [self invalidate:indexPath];
    [indexPaths addObject:indexPath];
  }
}

- (void)insertObject:(id)obj indexPath:(NSIndexPath *)indexPath {
  NSMutableArray *objectsForSection = [self objectsForSection:indexPath.section create:YES];
  [objectsForSection insertObject:obj atIndex:indexPath.item];
}

- (void)insertObjects:(NSArray *)objects section:(NSInteger)section position:(NSInteger)position indexPaths:(NSMutableArray *)indexPaths {
  NSMutableArray *objectsForSection = [self objectsForSection:section create:YES];
  if (position > [objectsForSection count]) position = [objectsForSection count];

  for (NSInteger i = 0; i < [objects count]; i++) {
    [objectsForSection insertObject:objects[i] atIndex:position + i];
    NSIndexPath *indexPath = [NSIndexPath indexPathForItem:position + i inSection:section];
    [self invalidate:indexPath];
    [indexPaths addObject:indexPath];
  }
}

- (void)addOrUpdateObjects:(NSArray *)objects section:(NSInteger)section indexPathsToAdd:(NSMutableArray *)indexPathsToAdd indexPathsToUpdate:(NSMutableArray *)indexPathsToUpdate {
  NSMutableArray *objectsToAdd = [NSMutableArray array];
  for (id object in objects) {
    NSIndexPath *indexPath = [self indexPathOfObject:object section:section];
    if (indexPath) {
      [self replaceObjectAtIndexPath:indexPath withObject:object];
      if (indexPathsToUpdate) [indexPathsToUpdate addObject:indexPath];
    } else {
      [objectsToAdd addObject:object];
    }
  }
  [self addObjects:objectsToAdd section:section indexPaths:indexPathsToAdd];
}

- (void)updateObjects:(NSArray *)objects section:(NSInteger)section indexPathsToAdd:(NSMutableArray *)indexPathsToAdd indexPathsToUpdate:(NSMutableArray *)indexPathsToUpdate indexPathsToRemove:(NSMutableArray *)indexPathsToRemove {
  NSArray *addObjects = [objects relativeComplement:[self objectsForSection:section]];
  NSArray *updateObjects = [[self objectsForSection:section] intersectionWithArray:objects];
  NSArray *removeObjects = [[self objectsForSection:section] relativeComplement:objects];

  for (id object in addObjects) {
    NSInteger position = [objects indexOfObjectIdenticalTo:object];
    [self insertObjects:@[object] section:section position:position indexPaths:indexPathsToAdd];
  }
  [self replaceObjects:updateObjects section:section indexPaths:indexPathsToUpdate];
  [self removeObjects:removeObjects section:section indexPaths:indexPathsToRemove];
}

- (void)updateObjects:(NSArray *)objects section:(NSInteger)section position:(NSInteger)position indexPathsToAdd:(NSMutableArray *)indexPathsToAdd indexPathsToUpdate:(NSMutableArray *)indexPathsToUpdate indexPathsToRemove:(NSMutableArray *)indexPathsToRemove {

  NSArray *addObjects = [objects relativeComplement:[self objectsForSection:section]];
  NSArray *updateObjects = [[self objectsForSection:section] intersectionWithArray:objects];
  NSArray *removeObjects = [[self objectsForSection:section] relativeComplement:objects];

  [self insertObjects:addObjects section:section position:position indexPaths:indexPathsToAdd];
  [self replaceObjects:updateObjects section:section indexPaths:indexPathsToUpdate];
  [self removeObjects:removeObjects section:section indexPaths:indexPathsToRemove];
}

- (void)replaceObjects:(NSArray *)objects section:(NSInteger)section indexPaths:(NSMutableArray *)indexPaths {
  for (id object in objects) {
    NSIndexPath *indexPath = [self indexPathOfObject:object section:section];
    NSAssert(indexPath, @"Object doesn't exist, can't replace it");
    [self replaceObjectAtIndexPath:indexPath withObject:object];
    [indexPaths addObject:indexPath];
  }
}

- (void)replaceObjects:(NSArray *)replaceObjects withObjects:(NSArray *)objects section:(NSInteger)section indexPathsToAdd:(NSMutableArray *)indexPathsToAdd indexPathsToUpdate:(NSMutableArray *)indexPathsToUpdate {

  NSAssert([replaceObjects count] == [objects count], @"Objects length mismatch");

  for (NSInteger i = 0; i < [objects count]; i++) {
    id replaceObject = [replaceObjects objectAtIndex:i];
    id object = [objects objectAtIndex:i];
    NSIndexPath *indexPath = [self indexPathOfObject:replaceObject section:section];
    if (indexPath) {
      [self replaceObjectAtIndexPath:indexPath withObject:object];
      if (indexPathsToUpdate) [indexPathsToUpdate addObject:indexPath];
    } else {
      [self addObjects:@[object] section:section indexPaths:indexPathsToAdd];
    }
  }
}

- (void)replaceObjectAtIndexPath:(NSIndexPath *)indexPath withObject:(id)object {
  NSMutableArray *objectsForSection = [self objectsForSection:indexPath.section create:YES];
  [objectsForSection replaceObjectAtIndex:indexPath.item withObject:object];
  [self invalidate:indexPath];
}

- (void)removeObjectsFromSection:(NSInteger)section indexPaths:(NSMutableArray *)indexPaths {
  NSMutableArray *objectsForSection = [self objectsForSection:section create:NO];
  if (indexPaths) {
    for (NSInteger i = 0; i < [objectsForSection count]; i++) [indexPaths addObject:[NSIndexPath indexPathForItem:i inSection:section]];
  }
  [objectsForSection removeAllObjects];
  [self invalidateAll];
}

- (void)removeObjects:(NSArray *)objects {
  [self removeObjects:objects section:0 indexPaths:nil];
}

- (void)removeObjectAtIndexPath:(NSIndexPath *)indexPath {
  NSMutableArray *objectsForSection = [self objectsForSection:indexPath.section create:NO];
  [objectsForSection removeObjectAtIndex:indexPath.item];
  [self invalidate:indexPath];
}

- (void)removeObjects:(NSArray *)objects section:(NSInteger)section indexPaths:(NSMutableArray *)indexPaths {
  NSMutableArray *objectsForSection = [self objectsForSection:section create:NO];
  if (!objectsForSection) return;
  for (id object in objects) {
    NSInteger index = [objectsForSection indexOfObject:object];
    if (index != NSNotFound) {
      NSIndexPath *indexPath = [NSIndexPath indexPathForItem:index inSection:section];
      [self invalidate:indexPath];
      [indexPaths addObject:indexPath];
    }
  }
  [objectsForSection removeObjectsInArray:objects];
}

- (void)invalidate:(NSIndexPath *)indexPath {
  [_sizeCache removeObjectForKey:indexPath];
}

- (void)invalidateAll {
  [_sizeCache removeAllObjects];
}

- (void)removeAllObjects {
  [_sections removeAllObjects];
  [self invalidateAll];
}

- (void)setObjects:(NSArray *)objects {
  [self setObjects:objects section:0 indexPathsToRemove:nil indexPathsToAdd:nil];
}

- (void)setObjects:(NSArray *)objects section:(NSInteger)section {
  [self setObjects:objects section:section indexPathsToRemove:nil indexPathsToAdd:nil];
}

- (void)setObjects:(NSArray *)objects section:(NSInteger)section indexPathsToRemove:(NSMutableArray *)indexPathsToRemove indexPathsToAdd:(NSMutableArray *)indexPathsToAdd {
  [self removeObjectsFromSection:section indexPaths:indexPathsToRemove];
  [self addObjects:objects section:section indexPaths:indexPathsToAdd];
  [self invalidateAll];
}

- (id)objectAtIndexPath:(NSIndexPath *)indexPath {
  NSArray *objects = [self objectsForSection:indexPath.section];
  return [objects objectAtIndex:indexPath.item];
}

- (id)lastObjectInSection:(NSInteger)section {
  NSInteger count = [self countForSection:section];
  if (count == 0) return nil;
  return [self objectAtIndexPath:[NSIndexPath indexPathForItem:(count - 1) inSection:section]];
}

- (NSUInteger)indexOfObject:(id)object section:(NSInteger)section {
  NSArray *objectsForSection = [self objectsForSection:section create:NO];
  if (!objectsForSection) return NSNotFound;
  return [objectsForSection indexOfObject:object];
}

- (NSIndexPath *)indexPathOfObject:(id)object section:(NSInteger)section {
  NSInteger index = [self indexOfObject:object section:section];
  if (index != NSNotFound) {
    return [NSIndexPath indexPathForItem:index inSection:section];
  }
  return nil;
}

- (id)findObject:(id)object section:(NSInteger)section {
  NSIndexPath *indexPath = [self indexPathOfObject:object section:section];
  if (indexPath) return [self objectAtIndexPath:indexPath];
  return nil;
}

- (NSArray *)indexPathsOfObjects:(NSArray *)objects section:(NSInteger)section {
  NSMutableArray *indexPaths = [NSMutableArray array];
  for (id object in objects) {
    NSIndexPath *indexPath = [self indexPathOfObject:object section:section];
    if (indexPath) [indexPaths addObject:indexPath];
  }
  return indexPaths;
}

- (NSIndexPath *)replaceObject:(id)object section:(NSInteger)section {
  NSIndexPath *indexPath = [self indexPathOfObject:object section:0];
  if (indexPath) {
    [self replaceObjectAtIndexPath:indexPath withObject:object];
    [self invalidate:indexPath];
  }
  return indexPath;
}

@end


@implementation NSIndexPath (KBCellDataSource)

- (NSInteger)item {
  return [self indexAtPosition:1];
}

- (NSInteger)section {
  return [self indexAtPosition:0];
}

+ (NSIndexPath *)indexPathForItem:(NSInteger)item inSection:(NSInteger)section {
  const NSUInteger indexes[2] = {section, item};
  return [NSIndexPath indexPathWithIndexes:indexes length:2];
}

@end