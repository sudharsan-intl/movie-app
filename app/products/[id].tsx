import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getProductTemplate,
  updateProductTemplate,
  deleteProductTemplates,
  type OdooProductTemplate,
  type UpdateProductTemplateInput,
} from "../../lib/odooClient";

const buildFormState = (product: OdooProductTemplate | null) => ({
  name: product?.name ?? "",
  price: typeof product?.list_price === "number" ? product.list_price.toString() : "",
  description: typeof product?.description_sale === "string" ? product.description_sale : "",
  defaultCode: typeof product?.default_code === "string" ? product.default_code : "",
  image: typeof product?.image_1920 === "string" ? product.image_1920 : "",
  saleOk: product?.sale_ok ?? true,
  active: product?.active ?? true,
});

type ProductFormState = ReturnType<typeof buildFormState>;
type TextFieldKey = Exclude<keyof ProductFormState, "saleOk" | "active">;
type BooleanFieldKey = Extract<keyof ProductFormState, "saleOk" | "active">;

type FeedbackState = {
  type: "success" | "error";
  message: string;
};

const gradientColors = ["#29115c", "#150641", "#040013"];

export default function ProductEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const numericId = useMemo(() => Number(id), [id]);

  const [product, setProduct] = useState<OdooProductTemplate | null>(null);
  const [form, setForm] = useState<ProductFormState>(buildFormState(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const loadProduct = useCallback(async () => {
    if (!Number.isFinite(numericId)) {
      setError("Invalid product identifier");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const record = await getProductTemplate(numericId);
      if (!record) {
        setError("Product not found on the server");
        setProduct(null);
        return;
      }

      setProduct(record);
      setForm(buildFormState(record));
      setFeedback(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load product";
      setError(message);
      setProduct(null);
    } finally {
      setIsLoading(false);
    }
  }, [numericId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const setTextField = useCallback(
    (key: TextFieldKey) => (value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const setBooleanField = useCallback(
    (key: BooleanFieldKey) => (value: boolean) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleReset = useCallback(() => {
    setForm(buildFormState(product));
    setFeedback(null);
  }, [product]);

  const handleDelete = useCallback(async () => {
    if (!Number.isFinite(numericId)) {
      setFeedback({ type: "error", message: "Invalid product identifier" });
      return;
    }

    setIsDeleting(true);
    setFeedback(null);

    try {
      const success = await deleteProductTemplates(numericId);
      if (!success) {
        setFeedback({ type: "error", message: "Failed to delete product" });
        return;
      }

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete product";
      setFeedback({ type: "error", message });
    } finally {
      setIsDeleting(false);
    }
  }, [numericId, router]);

  const handlePickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        setFeedback({ type: "error", message: "Media library permission is required" });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.base64) {
        setForm((prev) => ({ ...prev, image: asset.base64 }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pick image";
      setFeedback({ type: "error", message });
    }
  }, []);

  const handleClearImage = useCallback(() => {
    setForm((prev) => ({ ...prev, image: "" }));
  }, []);

  const imagePreview = form.image.length > 0
    ? { uri: `data:image/jpeg;base64,${form.image}` }
    : null;

  const handleSave = useCallback(async () => {
    if (!product || !Number.isFinite(numericId)) {
      return;
    }

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFeedback({ type: "error", message: "Product name is required" });
      return;
    }

    const parsedPrice = parseFloat(form.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setFeedback({ type: "error", message: "Enter a valid, non-negative price" });
      return;
    }

    const cleanedDescription = form.description.trim();
    const cleanedCode = form.defaultCode.trim();
    const currentImage = typeof product.image_1920 === "string" ? product.image_1920 : "";

    const hasChanges = trimmedName !== product.name ||
      parsedPrice !== product.list_price ||
      (product.description_sale ?? "") !== cleanedDescription ||
      (product.default_code ?? "") !== cleanedCode ||
      form.saleOk !== Boolean(product.sale_ok) ||
      form.active !== Boolean(product.active) ||
      form.image !== currentImage;

    if (!hasChanges) {
      setFeedback({ type: "success", message: "No changes to save" });
      return;
    }


    const updates: UpdateProductTemplateInput = {
      name: trimmedName,
      list_price: parsedPrice,
      description_sale: cleanedDescription,
      default_code: cleanedCode,
      image_1920: form.image.length > 0 ? form.image : false,
      sale_ok: form.saleOk,
      active: form.active,
    };

    setIsSaving(true);
    setFeedback(null);

    try {
      const success = await updateProductTemplate(numericId, updates);
      if (!success) {
        setFeedback({ type: "error", message: "Server ignored the update request" });
        return;
      }

      const refreshed = await getProductTemplate(numericId);
      if (refreshed) {
        setProduct(refreshed);
        setForm(buildFormState(refreshed));
      }

      setFeedback({ type: "success", message: "Product saved to Odoo" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes";
      setFeedback({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  }, [form, numericId, product]);

  return (
    <SafeAreaView className="flex-1 bg-[#050013]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.55, 1]}
        className="absolute inset-0"
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.1)", "rgba(0,0,0,0.2)"]}
        className="absolute inset-0 opacity-30"
      />

      <View className="flex-1 px-6">
        <View className="flex-row items-center justify-between pt-6">
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-11 w-11 items-center justify-center rounded-full bg-white/10"
          >
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </TouchableOpacity>

          <Ionicons name="create-outline" size={24} color="#ff9bff" />
        </View>

        <Text className="mt-6 text-2xl font-semibold text-white">Edit product</Text>
        <Text className="mt-2 text-sm text-white/70">
          Changes saved here are pushed directly to your Odoo database.
        </Text>

        {Number.isFinite(numericId) && (
          <View className="mt-4 self-start rounded-full border border-white/15 bg-white/5 px-3 py-1">
            <Text className="text-xs font-semibold text-white/65">Product ID #{numericId}</Text>
          </View>
        )}


        {error ? (
          <View className="mt-10 rounded-3xl border border-red-400/40 bg-red-900/20 p-4">
            <Text className="text-sm text-red-200/95">{error}</Text>
            <TouchableOpacity
              onPress={loadProduct}
              className="mt-4 self-start rounded-full bg-white/10 px-4 py-2"
            >
              <Text className="text-sm font-medium text-white">Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            className="mt-8"
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-6">
              <View>
                <Text className="text-xs uppercase tracking-widest text-white/60">Name</Text>
                <TextInput
                  value={form.name}
                  onChangeText={setTextField("name")}
                  placeholder="Product name"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white"
                />
              </View>
              <View className="mt-6">
                <Text className="text-xs uppercase tracking-widest text-white/60">Product image</Text>
                {imagePreview ? (
                  <Image
                    source={imagePreview}
                    className="mt-3 h-32 w-full rounded-3xl"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="mt-3 h-32 w-full items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5">
                    <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.6)" />
                    <Text className="mt-2 text-xs text-white/60">No image selected</Text>
                  </View>
                )}

                <View className="mt-4 flex-row gap-3">
                  <TouchableOpacity
                    onPress={handlePickImage}
                    className="flex-1 items-center rounded-full border border-white/15 bg-white/10 py-3"
                  >
                    <Text className="text-sm font-semibold text-white">Change image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleClearImage}
                    disabled={form.image.length === 0}
                    className={`flex-1 items-center rounded-full border border-white/15 py-3 ${
                      form.image.length === 0 ? "opacity-40" : "opacity-100"
                    }`}
                  >
                    <Text className="text-sm font-semibold text-white">Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text className="text-xs uppercase tracking-widest text-white/60">Price</Text>
                <TextInput
                  value={form.price}
                  onChangeText={setTextField("price")}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  keyboardType="decimal-pad"
                  className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white"
                />
              </View>

              <View>
                <Text className="text-xs uppercase tracking-widest text-white/60">
                  Description
                </Text>
                <TextInput
                  value={form.description}
                  onChangeText={setTextField("description")}
                  placeholder="Describe the product"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white"
                />
              </View>

              <View>
                <Text className="text-xs uppercase tracking-widest text-white/60">
                  Internal reference
                </Text>
                <TextInput
                  value={form.defaultCode}
                  onChangeText={setTextField("defaultCode")}
                  placeholder="SKU or reference"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white"
                />
              </View>

              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm font-medium text-white">Available for sale</Text>
                  <Text className="text-xs text-white/60">
                    Toggle to control if customers can buy this product.
                  </Text>
                </View>
                <Switch
                  value={form.saleOk}
                  onValueChange={setBooleanField("saleOk")}
                  trackColor={{ false: "rgba(255,255,255,0.25)", true: "#ff75ff" }}
                  thumbColor={form.saleOk ? "#ffffff" : "#cccccc"}
                />
              </View>

              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm font-medium text-white">Active</Text>
                  <Text className="text-xs text-white/60">
                    Inactive products stay hidden in the storefront.
                  </Text>
                </View>
                <Switch
                  value={form.active}
                  onValueChange={setBooleanField("active")}
                  trackColor={{ false: "rgba(255,255,255,0.25)", true: "#7c44ff" }}
                  thumbColor={form.active ? "#ffffff" : "#cccccc"}
                />
              </View>
            </View>

            {feedback && (
              <View
                className={`mt-8 rounded-2xl border px-4 py-3 ${
                  feedback.type === "success"
                    ? "border-emerald-400/40 bg-emerald-900/20"
                    : "border-red-400/40 bg-red-900/20"
                }`}
              >
                <Text
                  className={`text-sm ${
                    feedback.type === "success" ? "text-emerald-100" : "text-red-200"
                  }`}
                >
                  {feedback.message}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving || isLoading}
              className={`mt-10 items-center rounded-full bg-[#ff5470] py-3 ${
                isSaving || isLoading ? "opacity-60" : "opacity-100"
              }`}
            >
              <Text className="text-base font-semibold text-white">
                {isSaving ? "Saving..." : "Save changes"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleReset}
              disabled={isSaving || isLoading}
              className="mt-4 items-center rounded-full border border-white/20 py-3"
            >
              <Text className="text-base font-semibold text-white">Reset form</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              disabled={isSaving || isLoading || isDeleting}
              className={`mt-4 items-center rounded-full border border-red-400/40 bg-red-600/80 py-3 ${
                isDeleting ? "opacity-60" : "opacity-100"
              }`}
            >
              <Text className="text-base font-semibold text-white">
                {isDeleting ? "Deleting..." : "Delete product"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {(isLoading || isSaving || isDeleting) && (
        <View className="absolute inset-0 items-center justify-center bg-black/30">
          <ActivityIndicator size="large" color="#ff75ff" />
        </View>
      )}
    </SafeAreaView>
  );
}
