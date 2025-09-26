import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

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

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#f97316",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopWidth: 0,
          height: 64,
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
