import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, StatusBar, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";

import { useAuth } from "../../lib/auth";

const buildWorkspaceUrl = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

const escapeJsString = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\"/g, '\\"');

const buildAutoLoginHtml = (
  baseUrl: string,
  login: string,
  password: string,
  database: string,
  redirectPath: string
) => {
  const loginJs = escapeJsString(login);
  const passwordJs = escapeJsString(password);
  const dbJs = escapeJsString(database);
  const redirectJs = escapeJsString(redirectPath);
  const loginUrl = `${baseUrl}/web/login`;
  const fallbackUrl = `${baseUrl}${redirectPath}`;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { background: #ffffff; margin: 0; }
    </style>
  </head>
  <body>
    <script>
      (function () {
        const params = new URLSearchParams();
        params.set('login', '${loginJs}');
        params.set('password', '${passwordJs}');
        if ('${dbJs}'.length > 0) {
          params.set('db', '${dbJs}');
        }
        params.set('redirect', '${redirectJs}');

        const loginUrl = '${loginUrl}';
        const fallbackUrl = '${fallbackUrl}';

        fetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          credentials: 'include',
          body: params.toString(),
        })
          .then((response) => {
            const target = response.url && response.url.indexOf('/web/login') === -1
              ? response.url
              : fallbackUrl;
            window.location.replace(target);
          })
          .catch(() => {
            window.location.replace(fallbackUrl);
          });
      })();
    </script>
  </body>
</html>`;
};

export default function PortalMenuWebView() {
  const params = useLocalSearchParams<{ menuId?: string }>();
  const { session } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const [isPortalReady, setIsPortalReady] = useState(false);

  const workspaceUrl = useMemo(() => buildWorkspaceUrl(session?.serverUrl), [session?.serverUrl]);
  const menuRedirect = useMemo(() => {
    const menuId = params.menuId ? Number(params.menuId) : undefined;
    return menuId && Number.isFinite(menuId) ? `/web#menu_id=${menuId}` : `/web`;
  }, [params.menuId]);

  const autoLoginSource = useMemo(() => {
    if (!workspaceUrl || !session?.username || !session?.password) {
      return null;
    }

    const html = buildAutoLoginHtml(
      workspaceUrl,
      session.username,
      session.password,
      session.database ?? '',
      menuRedirect
    );

    return { html, baseUrl: workspaceUrl };
  }, [session?.username, session?.password, session?.database, workspaceUrl, menuRedirect]);

  const handleNavigation = useCallback(
    (state: { url?: string }) => {
      const url = state?.url ?? '';
      if (!isPortalReady && url.startsWith(workspaceUrl ?? '') && !url.includes('/web/login')) {
        setIsPortalReady(true);
      }
    },
    [isPortalReady, workspaceUrl]
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      {!autoLoginSource ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-gray-800">
            Unable to determine the Odoo portal URL for this session.
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          {!isPortalReady && (
            <View className="absolute inset-0 z-10 items-center justify-center bg-white">
              <ActivityIndicator color="#7c44ff" />
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={autoLoginSource}
            originWhitelist={["*"]}
            javaScriptEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            onNavigationStateChange={handleNavigation}           onLoadEnd={({ nativeEvent }) => handleNavigation(nativeEvent)}
            style={{ flex: 1, backgroundColor: '#ffffff', opacity: isPortalReady ? 1 : 0 }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}




