import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { TextInputProps } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "../lib/auth";

type InputFieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
};

const InputField = ({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = "default",
  autoCapitalize = "none",
  autoComplete = "off",
  textContentType,
}: InputFieldProps) => (
  <View className="mb-4">
    <View className="flex-row items-center gap-3 rounded-2xl bg-white/12 px-4 py-4">
      <Ionicons name={icon} size={20} color="rgba(255,255,255,0.85)" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.6)"
        className="flex-1 text-base text-white"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        autoCorrect={false}
      />
    </View>
  </View>
);

const MIN_PASSWORD_LENGTH = 1;

const LoginScreen = () => {
  const { status, signIn, error, lastServerUrl, lastUsername } = useAuth();
  const [serverUrl, setServerUrl] = useState(lastServerUrl);
  const [username, setUsername] = useState(lastUsername);
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isAuthenticating = status === "authenticating";
  const isAuthenticated = status === "authenticated";

  const combinedError = useMemo(() => localError ?? error, [localError, error]);

  const handleServerChange = useCallback((value: string) => {
    setServerUrl(value);
    if (localError) setLocalError(null);
  }, [localError]);

  const handleUsernameChange = useCallback((value: string) => {
    setUsername(value);
    if (localError) setLocalError(null);
  }, [localError]);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    if (localError) setLocalError(null);
  }, [localError]);

  const handleDatabaseChange = useCallback((value: string) => {
    setDatabase(value);
    if (localError) setLocalError(null);
  }, [localError]);

  const handleOpenOdoo = useCallback(() => {
    Linking.openURL("https://www.odoo.com");
  }, []);

  const isSubmitDisabled = useMemo(() => {
    const hasServer = serverUrl.trim().length > 0;
    const hasUsername = username.trim().length > 0;
    const hasPassword = password.trim().length >= MIN_PASSWORD_LENGTH;
    return !hasServer || !hasUsername || !hasPassword || isAuthenticating || isAuthenticated;
  }, [serverUrl, username, password, isAuthenticating, isAuthenticated]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitDisabled) return;
    setLocalError(null);

    try {
      await signIn({
        serverUrl,
        username,
        password,
        database: showAdvanced ? database : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in with the provided credentials.";
      setLocalError(message);
    }
  }, [database, isSubmitDisabled, password, serverUrl, showAdvanced, signIn, username]);

  return (
    <SafeAreaView className="flex-1 bg-[#350948]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#5f1c6f", "#401060", "#23053d"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 px-6 pb-10 pt-14">
          <View className="items-center">
            <Text className="text-5xl font-bold lowercase tracking-widest text-white">odoo</Text>
          </View>

          <View className="mt-14">
            <InputField
              icon="earth"
              placeholder="Server address"
              value={serverUrl}
              onChangeText={handleServerChange}
              keyboardType="url"
              autoCapitalize="none"
              autoComplete="off"
              textContentType="URL"
            />

            <InputField
              icon="person"
              placeholder="Email/Username"
              value={username}
              onChangeText={handleUsernameChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
            />

            <InputField
              icon="lock-closed"
              placeholder="Password"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
            />

            {showAdvanced && (
              <InputField
                icon="layers"
                placeholder="Database (optional)"
                value={database}
                onChangeText={handleDatabaseChange}
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
              />
            )}

            <TouchableOpacity
              onPress={() => setShowAdvanced((prev) => !prev)}
              className="mt-2 self-end"
              accessibilityRole="button"
            >
              <Text className="text-xs font-medium text-white/70 underline">
                {showAdvanced ? "Hide advanced" : "Advanced settings"}
              </Text>
            </TouchableOpacity>

            {combinedError && (
              <View className="mt-6 rounded-2xl border border-red-400/40 bg-red-900/25 px-4 py-3">
                <Text className="text-sm text-red-100/90">{combinedError}</Text>
              </View>
            )}

            <TouchableOpacity
              className="mt-6 h-14 items-center justify-center rounded-2xl bg-[#00a884]"
              onPress={handleSubmit}
              disabled={isSubmitDisabled}
              accessibilityRole="button"
              accessibilityLabel="Sign in to Odoo"
            >
              {isAuthenticating ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold uppercase tracking-[2px] text-white">
                  Login
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-6 items-center"
              accessibilityRole="button"
              accessibilityLabel="Open the official Odoo website"
              onPress={handleOpenOdoo}
            >
              <Text className="text-sm text-white/70">Create an account on odoo.com</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
