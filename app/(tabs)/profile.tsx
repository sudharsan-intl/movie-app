import { SafeAreaView, View, Text, StatusBar, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useAuth } from "../../lib/auth";

const PATTERN_URI = "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80";

export default function Profile() {
  const { user, session, signOut } = useAuth();

  const displayName = user?.name ?? session?.username ?? "Portal user";
  const email = user?.email ?? session?.username ?? "Unknown";
  const server = session?.serverUrl ?? "—";
  const database = session?.database ?? "—";

  return (
    <SafeAreaView className="flex-1 bg-[#050013]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#29115c", "#150641", "#040013"]}
        locations={[0, 0.55, 1]}
        className="absolute inset-0"
      />
      <Image
        source={{ uri: PATTERN_URI }}
        resizeMode="cover"
        className="absolute inset-0 opacity-30"
        blurRadius={20}
      />

      <View className="flex-1 px-6 pt-16">
        <View className="items-center">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-white/10">
            <Ionicons name="person-circle" size={72} color="rgba(255,255,255,0.85)" />
          </View>
          <Text className="mt-6 text-2xl font-semibold text-white">{displayName}</Text>
          <Text className="mt-2 text-sm text-white/70">{email}</Text>
        </View>

        <View className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-6">
          <Text className="text-base font-semibold text-white">Workspace</Text>
          <View className="mt-4 gap-3">
            <View>
              <Text className="text-xs uppercase tracking-wider text-white/60">Server</Text>
              <Text className="mt-1 text-sm text-white/80">{server}</Text>
            </View>
            <View>
              <Text className="text-xs uppercase tracking-wider text-white/60">Database</Text>
              <Text className="mt-1 text-sm text-white/80">{database}</Text>
            </View>
            <View>
              <Text className="text-xs uppercase tracking-wider text-white/60">User ID</Text>
              <Text className="mt-1 text-sm text-white/80">{session?.uid ?? "—"}</Text>
            </View>
          </View>
        </View>

        <View className="mt-auto pb-24">
          <TouchableOpacity
            onPress={signOut}
            className="h-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10"
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text className="text-base font-semibold text-white">Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

