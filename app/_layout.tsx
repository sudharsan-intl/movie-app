import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";

import { AuthProvider, useAuth } from "../lib/auth";

const RootNavigator = () => {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const firstSegment = segments?.[0];
    if (!firstSegment) return;

    const onLoginScreen = firstSegment === "login";

    if (status === "authenticated" && onLoginScreen) {
      router.replace("/(tabs)");
    } else if (status !== "authenticated" && !onLoginScreen) {
      router.replace("/login");
    }
  }, [segments, status, router]);

  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="portal/index" options={{ headerShown: false }} />
      <Stack.Screen name="portal/[menuId]" options={{ headerShown: false }} />
      <Stack.Screen name="movies/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="products/[id]" options={{ headerShown: false }} />
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
