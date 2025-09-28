import {
  SafeAreaView,
  View,
  StatusBar,
  TouchableOpacity,
  Text,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { fetchProductTemplates, type OdooProductTemplate } from "../../lib/odooClient";

const LogoBadge = () => (
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

export default function Index() {
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<OdooProductTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const loadProducts = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const data = await fetchProductTemplates({ limit: 40 });
      setProducts(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load products";
      setError(message);
      if (!refresh) {
        setProducts([]);
      }
    } finally {
      if (refresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadProducts().finally(() => {
      if (isMounted) {
        hasLoadedOnce.current = true;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadProducts]);

  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;

    if (isFocused) {
      const hasText = query.trim().length > 0;
      parent.setOptions({
        tabBarStyle: hasText ? { display: "none" } : DEFAULT_TAB_STYLE,
      });
    }

    return () => {
      parent?.setOptions({ tabBarStyle: DEFAULT_TAB_STYLE });
    };
  }, [navigation, isFocused, query]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce.current) {
        loadProducts(true);
      }
    }, [loadProducts])
  );

  const handleRefreshPress = useCallback(() => {
    if (isLoading || isRefreshing) return;
    loadProducts(true);
  }, [isLoading, isRefreshing, loadProducts]);

  const handleSearchFocus = useCallback(() => {
    router.push("/(tabs)/search");
  }, [router]);

  const handleProductPress = useCallback((item: OdooProductTemplate) => {
    router.push({
      pathname: '/products/[id]',
      params: { id: String(item.id) },
    });
  }, [router]);

  const renderProduct = useCallback(({ item }: { item: OdooProductTemplate }) => {
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
          <Image source={imageSource} className="h-24 w-24 rounded-2xl" resizeMode="cover" />
        ) : (
          <View className="h-24 w-24 items-center justify-center rounded-2xl bg-white/10">
            <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.6)" />
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
            <Text className="mt-2 text-sm font-medium text-[#ffd966]">{priceLabel}</Text>
          )}
          {blurb && (
            <Text className="mt-2 text-xs text-white/70" numberOfLines={3}>
              {blurb}
            </Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
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
          <LogoBadge />
        </View>

        <View className="mt-16 flex-row items-center gap-3">
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.85)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search products"
            placeholderTextColor="rgba(255,255,255,0.65)"
            className="flex-1 text-base text-white"
            onFocus={handleSearchFocus}
          />
        </View>

        <View className="relative mt-10 flex-1">
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-xl font-semibold text-white">Latest products</Text>
            <TouchableOpacity
              onPress={handleRefreshPress}
              disabled={isLoading || isRefreshing}
              accessibilityRole="button"
              accessibilityLabel="Refresh product list"
              className="rounded-full bg-white/10 p-2"
            >
              <Ionicons
                name="refresh"
                size={18}
                color={isLoading || isRefreshing ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)"}
              />
            </TouchableOpacity>
          </View>

          {error ? (
            <View className="flex-1 items-center justify-center rounded-3xl border border-red-400/30 bg-red-900/20 px-6 py-10">
              <Text className="text-center text-sm text-red-200/90">{error}</Text>
              <TouchableOpacity
                onPress={handleRefreshPress}
                className="mt-5 rounded-full bg-white/10 px-5 py-2"
                accessibilityRole="button"
                accessibilityLabel="Retry loading products"
              >
                <Text className="text-sm font-medium text-white">Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderProduct}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 140 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => loadProducts(true)}
                  tintColor="#ff75ff"
                  colors={["#ff75ff"]}
                />
              }
              ListEmptyComponent={
                !isLoading ? (
                  <View className="items-center justify-center py-24">
                    <Ionicons name="cart-outline" size={40} color="rgba(255,255,255,0.3)" />
                    <Text className="mt-4 text-center text-sm text-white/70">
                      Products will appear here once they are available in Odoo.
                    </Text>
                  </View>
                ) : null
              }
            />
          )}

          {isLoading && !isRefreshing && (
            <View className="pointer-events-none absolute inset-x-0 top-16 items-center">
              <ActivityIndicator size="small" color="#ff75ff" />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}





