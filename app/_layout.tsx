import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Pressable, Text, View } from "react-native";
import { StoreProvider } from "../src/store";
import { colors, ui } from "../src/theme";
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={ui.center}>
      <Text style={ui.heading}>日历遇到了一点问题</Text>
      <Text style={ui.sub}>已保存的数据仍保留在本机，请重试。</Text>
      <Pressable style={ui.button} onPress={retry}>
        <Text style={ui.buttonText}>重新打开</Text>
      </Pressable>
    </View>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StoreProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="event" options={{ gestureEnabled: false }} />
          <Stack.Screen name="settings" />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
