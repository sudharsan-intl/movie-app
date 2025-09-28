import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type TabName = "index" | "profile" | "saved" | "search";

type TabConfig = {
  name: TabName;
  title: string;
  icons: {
    focused: keyof typeof Ionicons.glyphMap;
    default: keyof typeof Ionicons.glyphMap;
  };
};

const TAB_CONFIG: TabConfig[] = [
  {
    name: "index",
    title: "Home",
    icons: { focused: "home", default: "home-outline" },
  },
  {
    name: "search",
    title: "Search",
    icons: { focused: "search", default: "search-outline" },
  },
  {
    name: "saved",
    title: "Saved",
    icons: { focused: "bookmark", default: "bookmark-outline" },
  },
  {
    name: "profile",
    title: "Profile",
    icons: { focused: "person", default: "person-outline" },
  },
];

const TAB_COLORS = ["#ff4fd8", "#c435ff", "#753bff"];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "rgba(255,255,255,0.75)",
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <LinearGradient
            colors={TAB_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 70 }}
          />
        ),
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderRadius: 70,
          borderTopWidth: 0,
          height: 62,
          marginHorizontal: 16,
          marginBottom: Platform.OS === "ios" ? 22 : 14,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 6,
          textTransform: "none",
        },
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? tab.icons.focused : tab.icons.default}
                color={color}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
