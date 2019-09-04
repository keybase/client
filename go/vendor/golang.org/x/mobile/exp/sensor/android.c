// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build android

#include <stdlib.h>
#include <jni.h>

#include <android/sensor.h>

#define GO_ANDROID_SENSOR_LOOPER_ID 100

#define GO_ANDROID_READ_TIMEOUT_MS 1000

ASensorEventQueue* queue = NULL;
ALooper* looper = NULL;

static ASensorManager* getSensorManager() {
  #pragma clang diagnostic push
  // Builders convert C warnings to errors, so suppress the
  // error from ASensorManager_getInstance being deprecated
  // in Android 26.
  #pragma clang diagnostic ignored "-Wdeprecated-declarations"
  return ASensorManager_getInstance();
  #pragma clang diagnostic pop
}

void GoAndroid_createManager() {
  ASensorManager* manager = getSensorManager();
  looper = ALooper_forThread();
  if (looper == NULL) {
    looper = ALooper_prepare(ALOOPER_PREPARE_ALLOW_NON_CALLBACKS);
  }
  queue = ASensorManager_createEventQueue(manager, looper, GO_ANDROID_SENSOR_LOOPER_ID, NULL, NULL);
}

int GoAndroid_enableSensor(int s, int32_t usec) {
  ASensorManager* manager = getSensorManager();
  const ASensor* sensor = ASensorManager_getDefaultSensor(manager, s);
  if (sensor == NULL) {
    return 1;
  }
  ASensorEventQueue_enableSensor(queue, sensor);
  ASensorEventQueue_setEventRate(queue, sensor, usec);
  return 0;
}

void GoAndroid_disableSensor(int s) {
  ASensorManager* manager = getSensorManager();
  const ASensor* sensor = ASensorManager_getDefaultSensor(manager, s);
  ASensorEventQueue_disableSensor(queue, sensor);
}

int GoAndroid_readQueue(int n, int32_t* types, int64_t* timestamps, float* vectors) {
  int id;
  int events;
  ASensorEvent event;
  int i = 0;
  // Try n times read from the event queue.
  // If anytime timeout occurs, don't retry to read and immediately return.
  // Consume the event queue entirely between polls.
  while (i < n && (id = ALooper_pollAll(GO_ANDROID_READ_TIMEOUT_MS, NULL, &events, NULL)) >= 0) {
    if (id != GO_ANDROID_SENSOR_LOOPER_ID) {
      continue;
    }
    while (i < n && ASensorEventQueue_getEvents(queue, &event, 1)) {
      types[i] = event.type;
      timestamps[i] = event.timestamp;
      vectors[i*3] = event.vector.x;
      vectors[i*3+1] = event.vector.y;
      vectors[i*3+2] = event.vector.z;
      i++;
    }
  }
  return i;
}

void GoAndroid_destroyManager() {
  ASensorManager* manager = getSensorManager();
  ASensorManager_destroyEventQueue(manager, queue);
  queue = NULL;
  looper = NULL;
}
