import { SafeAreaView, View, Text, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "react-native";

const PATTERN_URI = "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80";

export default function Saved() {
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

      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-semibold text-white">Saved</Text>
        <Text className="mt-4 text-sm text-white/70 text-center">
          Items you bookmark will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
