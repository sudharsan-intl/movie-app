import {
  SafeAreaView,
  View,
  StatusBar,
  TextInput,
  Pressable,
  FlatList,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  fetchProductTemplates,
  searchProductTemplates,
  type OdooProductTemplate,
} from "../../lib/odooClient";

type LogoBadgeProps = {
  onPress?: () => void;
};

const LogoBadge = ({ onPress }: LogoBadgeProps) => (
  <Pressable
    onPress={onPress}
    hitSlop={12}
    accessibilityRole="button"
    accessibilityLabel="Go to Home tab"
  >
    <LinearGradient
      colors={["#ff75ff", "#ff5470", "#7c44ff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="h-16 w-16 items-center justify-center rounded-full"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-[#050013]">
        <Ionicons name="cart-outline" size={30} color="#ffe3ff" />
      </View>
    </LinearGradient>
  </Pressable>
);

const DEFAULT_TAB_STYLE = {
  position: "absolute" as const,
  backgroundColor: "transparent",
  borderRadius: 70,
  borderTopWidth: 0,
  height: 62,
  marginHorizontal: 16,
  marginBottom: 14,
  paddingTop: 8,
};

const TAB_BACKGROUND_COLORS = ["#ff4fd8", "#c435ff", "#753bff"];

const TabBarGradientBackground = () => (
  <LinearGradient
    colors={TAB_BACKGROUND_COLORS}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={{ flex: 1, borderRadius: 70 }}
  />
);

const HiddenTabBarBackground = () => null;

const HIDDEN_TAB_STYLE = { display: "none" as const };

const formatPrice = (value: unknown, currency?: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;

  if (Array.isArray(currency) && currency.length > 1) {
    return `${String(currency[1])} ${numeric.toFixed(2)}`;
  }

  return `$ ${numeric.toFixed(2)}`;
};

const stripHtml = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};

const getImageSource = (record: Partial<OdooProductTemplate>) => {
  const image = typeof record.image_512 === "string" && record.image_512.length > 0
    ? record.image_512
    : typeof record.image_256 === "string" && record.image_256.length > 0
      ? record.image_256
      : typeof record.image_1920 === "string" && record.image_1920.length > 0
        ? record.image_1920
        : null;

  return image ? { uri: `data:image/png;base64,${image}` } : null;
};

export default function Search() {
  const params = useLocalSearchParams<{ query?: string }>();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OdooProductTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const handleLogoPress = useCallback(() => {
    const parent = navigation.getParent();
    parent?.navigate("index");
  }, [navigation]);

  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;

    if (isFocused) {
      const hasText = query.trim().length > 0;

      parent.setOptions(
        hasText
          ? {
              tabBarStyle: HIDDEN_TAB_STYLE,
              tabBarBackground: HiddenTabBarBackground,
            }
          : {
              tabBarStyle: DEFAULT_TAB_STYLE,
              tabBarBackground: TabBarGradientBackground,
            }
      );
    }

    return () => {
      parent?.setOptions({
        tabBarStyle: DEFAULT_TAB_STYLE,
        tabBarBackground: TabBarGradientBackground,
      });
    };
  }, [navigation, isFocused, query]);

  useEffect(() => {
    if (typeof params.query === "string") {
      setQuery(params.query);
    }
  }, [params.query]);

  useEffect(() => {
    const trimmed = query.trim();
    let isCancelled = false;

    const runSearch = () => {
      setIsLoading(true);
      setError(null);

      const request = trimmed
        ? searchProductTemplates(trimmed, { limit: 25 })
        : fetchProductTemplates({ limit: 40 });

      request
        .then((products) => {
          if (isCancelled) return;
          setResults(products);
          setError(null);
        })
        .catch((err) => {
          if (isCancelled) return;
          const message = err instanceof Error ? err.message : "Failed to fetch results";
          setError(message);
          setResults([]);
        })
        .finally(() => {
          if (isCancelled) return;
          setIsLoading(false);
        });
    };

    const delay = trimmed.length > 0 ? 350 : 0;
    const timeoutId = setTimeout(runSearch, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [query]);


  const handleProductPress = useCallback((product: OdooProductTemplate) => {
    router.push({
      pathname: "/products/[id]",
      params: { id: String(product.id) },
    });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: OdooProductTemplate }) => {
    const imageSource = getImageSource(item);
    const priceLabel = formatPrice(item.list_price, item.currency_id);
    const blurb = stripHtml(item.description_sale);

    return (
      <TouchableOpacity
        onPress={() => handleProductPress(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.name}`}
        className="mb-4 flex-row items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4"
      >
        {imageSource ? (
          <Image source={imageSource} className="h-20 w-20 rounded-2xl" resizeMode="cover" />
        ) : (
          <View className="h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
            <Ionicons name="image-outline" size={20} color="rgba(255,255,255,0.6)" />
          </View>
        )}

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-base font-semibold text-white" numberOfLines={2}>
              {item.name}
            </Text>
            <Text className="text-xs font-semibold uppercase tracking-wide text-white/45">#{item.id}</Text>
          </View>
          {priceLabel && (
            <Text className="mt-1 text-sm font-medium text-[#ffd966]">{priceLabel}</Text>
          )}
          {blurb && (
            <Text className="mt-2 text-xs text-white/70" numberOfLines={2}>
              {blurb}
            </Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>
    );
  }, [handleProductPress]);

  return (
    <SafeAreaView className="flex-1 bg-[#050013]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#29115c", "#150641", "#040013"]}
        locations={[0, 0.55, 1]}
        className="absolute inset-0"
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.1)", "rgba(0,0,0,0.2)"]}
        className="absolute inset-0 opacity-30"
      />

      <View className="flex-1 px-6">
        <View className="items-center pt-[72px]">
          <LogoBadge onPress={handleLogoPress} />
        </View>

        <View className="mt-16 flex-row items-center gap-3">
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.85)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search products"
            placeholderTextColor="rgba(255,255,255,0.65)"
            className="flex-1 text-base text-white"
            autoFocus
            returnKeyType="search"
          />
        </View>

        <View className="mt-8 flex-1">
          {error ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-center text-sm text-red-200/90">{error}</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              ListEmptyComponent={
                !isLoading ? (
                  query.trim().length > 0 ? (
                    <View className="flex-1 items-center justify-center py-24">
                      <Ionicons name="search" size={44} color="rgba(255,255,255,0.3)" />
                      <Text className="mt-4 text-center text-sm text-white/70">
                        Couldn't find matches for "{query.trim()}".
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-1 items-center justify-center py-24">
                      <Ionicons name="cube-outline" size={44} color="rgba(255,255,255,0.3)" />
                      <Text className="mt-4 text-center text-sm text-white/70">
                        No products are available right now.
                      </Text>
                    </View>
                  )
                ) : null
              }
            />
          )}

          {isLoading && !error && (
            <View className="absolute inset-x-0 top-4 items-center">
              <ActivityIndicator size="small" color="#ff75ff" />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}


