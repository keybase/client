import React from 'react';
import {View, Text, DynamicColorIOS} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

function Screen() {
  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text>Test Screen</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={Screen}
          options={{
            headerStyle: {
              backgroundColor: DynamicColorIOS({
                light: 'green',
                dark: 'blue',
              }),
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
